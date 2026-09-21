import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../../__fixtures__/keys.js";
import { CwsKit } from "../../classes/CwsKit.js";
import { JwsKit } from "../../classes/JwsKit.js";
import type { WireProtectedHeader } from "../../types/index.js";
import { decodeCbor, Tag } from "../cose/cbor.js";
import type { CoseLabel } from "../cose/cose-label.js";
import { decodeProtectedHeader } from "../cose/structures.js";
import { KIT_CAPABILITIES } from "../registry/kit-capabilities.js";
import type { HeaderSpec } from "../registry/header-spec.js";
import { wireKeyLabel, wireKeyName } from "../registry/wire-key.js";
import { coseWireKey, HEADER_SPECS } from "./header-registry.js";

const logger = createMockLogger();

/**
 * ⭐ ONE CALL, TWO ENCODINGS, ONE ANSWER — the PARITY guard between the two
 * encodings, for the parameters a caller can set and COSE can carry, generated
 * FROM the registry so no new parameter has to be remembered into it.
 *
 * A caller who can choose the encoding must not be able to choose the OUTCOME. If a
 * parameter reaches the JOSE wire and vanishes on the COSE one — or is refused on
 * one and minted on the other — then the same call means two different things, and
 * which one it means is picked by whoever picks the wire. The shape of it: the JOSE
 * tiers cross a normalisation while the COSE derived tier is written straight into
 * the label map, so a caller `cty: ""` prunes on one wire and emits `[3, ""]` on
 * the other.
 *
 * ⚠ IT IS NOT THE GUARD FOR THE REGISTRY, AND MUST NOT BE READ AS ONE. It compares
 * the two wires with each other; it says nothing about whether either is RIGHT.
 * Flipping `oid`'s `whenEmpty` from `prune` to `keep` moves BOTH wires together —
 * the parity assertion stays green, and only the frozen verdict notices that the
 * answer changed at all. Regenerate the snapshot and the wrong cell is accepted
 * here, because the two wires still agree about it. Whether a cell is RIGHT is
 * `normalise-headers.test.ts` plus the feature files; what this file owns is that
 * the two encodings answer the SAME call the same way.
 *
 * ⚠ THE PARTICIPANTS ARE DERIVED, NEVER LISTED. Two exclusions, each read off data
 * that already exists for its own reasons — an allowlist written here would be one
 * more thing to keep in step, the failure mode the guard exists to remove:
 *
 *   - a parameter the KITS RESERVE (`KitCapabilities.reserved`, the union of the
 *     JOSE and COSE rows). A caller cannot set it at all, so a caller's choice of
 *     encoding reaches nothing.
 *   - a parameter COSE DOES NOT CARRY (`wire.cose` is `absent`). There is no label
 *     for it to be present under, so the wires cannot agree and are not asked to;
 *     the registry states the absence with its reason, on the entry.
 *
 * The surviving count is the registry's, not a target: it moves when a parameter is
 * added, when one gains a COSE label, or when the kits reserve one. It is asserted
 * below rather than restated here.
 *
 * ⚠ THE VERDICT IS A CLASS, NOT A CODE. The two wires namespace their refusals
 * differently by design — `jose_reserved_header` / `cose_reserved_header`,
 * `jws_invalid_crit` / `cws_invalid_crit` — so comparing codes would fail on the
 * naming rather than on the behaviour. What must agree is whether the call was
 * REFUSED, whether the parameter reached the wire, or whether it emitted nothing.
 *
 * ⚠ ONE KIT PER ENCODING is enough, and `JwsKit`/`CwsKit` are the pair: the
 * reserved rows are shared across all three JOSE kits and all four COSE ones
 * (`kit-capabilities.ts`), and the header assembly under test is `buildJoseHeader`
 * / `buildCoseHeaders` + `mergeCoseProtected`, which every kit of its encoding
 * calls. A per-kit sweep would re-run one mechanism seven times.
 */
type Verdict = "present" | "absent" | "refused";

/** The reserved union of both encodings — a caller can set none of these. */
const RESERVED = new Set<string>([
  ...KIT_CAPABILITIES.jws.reserved,
  ...KIT_CAPABILITIES.cws.reserved,
]);

/**
 * The EMPTY form of a parameter's value, per its codec kind, or `undefined` where
 * the kind has none. `buffer` and `number` are the two: `isEmpty` calls neither a
 * zero-length Buffer nor `0` empty, which is the same answer `whenEmpty`'s own
 * documentation gives, so there is no empty form to mint.
 */
const emptyFormOf = (spec: HeaderSpec): unknown => {
  switch (spec.codec.kind) {
    case "string":
    case "url":
      return "";
    case "array":
    case "critical":
      return [];
    case "jwk":
      return {};
    case "buffer":
    case "number":
      return undefined;
    // ⚠ THE ONE REGISTRY FACT THIS FILE STILL HAS TO BE TOLD, so it is told by the
    // compiler rather than remembered: an eighth `HeaderCodec` kind would fall out
    // of a defaultless switch as `undefined`, the empty-form rows would silently
    // drop that parameter, and nothing would be red. `buffer` and `number` state
    // their `undefined` EXPLICITLY for the same reason — they have no empty form,
    // and that is a decision, not a fall-through.
    default: {
      const exhaustive: never = spec.codec;
      throw new Error(
        `Header codec kind declares no empty form: ${JSON.stringify(exhaustive)}`,
      );
    }
  }
};

const joseVerdict = (jose: string, value: unknown): Verdict => {
  let token: string;

  try {
    token = new JwsKit({ logger, kryptos: TEST_EC_KEY_SIG }).sign("data", {
      header: { [jose]: value } as WireProtectedHeader,
    });
  } catch {
    return "refused";
  }

  const header = JSON.parse(
    Buffer.from(token.split(".")[0] as string, "base64url").toString("utf8"),
  );

  return Object.hasOwn(header, jose) ? "present" : "absent";
};

const coseVerdict = (jose: string, label: CoseLabel, value: unknown): Verdict => {
  let token: Buffer;

  try {
    token = new CwsKit({ logger, kryptos: TEST_EC_KEY_SIG }).sign(Buffer.from("data"), {
      header: { [jose]: value } as WireProtectedHeader,
    });
  } catch {
    return "refused";
  }

  // `CwsKit.sign` returns the TAGGED structure — COSE_Sign1 (18) / COSE_Mac0
  // (17) over `[protected, unprotected, payload, signature]`, the protected
  // bucket a `bstr` holding its own encoded map. Only the PROTECTED bucket is
  // read: the JOSE compact serialisation has no second bucket to compare it
  // against, so an unprotected COSE parameter has no JOSE counterpart at all.
  const [protectedBstr] = decodeCbor<Tag>(token).contents as [Uint8Array];

  return decodeProtectedHeader(protectedBstr).has(label) ? "present" : "absent";
};

/**
 * A row per participant, so a failure names the PARAMETER rather than a position
 * in a loop, and the two verdicts land in the diff.
 */
const PARTICIPANTS = HEADER_SPECS.filter((spec) => {
  const jose = wireKeyName(spec.wire.jose);
  return (
    jose !== undefined &&
    !RESERVED.has(jose) &&
    wireKeyLabel(spec.wire.cose) !== undefined
  );
}).map((spec) => {
  const jose = wireKeyName(spec.wire.jose) as string;

  return {
    jose,
    // ⚠ The WRITER'S resolver, not the raw label. A PRIVATE-USE label (`oid`) is
    // written under its string spelling in the interoperable default mode, so a
    // lookup by integer would report the parameter absent from a wire that
    // carries it — a difference in this test's own key resolution reported as a
    // difference between the wires. `false` is the kits' default mode.
    label: coseWireKey(jose, false),
    sample: spec.sample,
    empty: emptyFormOf(spec),
  };
});

describe("the JOSE and COSE wires answer the same call identically", () => {
  // A guard whose participant set silently emptied would pass forever. The count
  // is the registry's, not a target: it moves when a parameter is added, when one
  // gains a COSE label, or when the kits reserve one — each a change whose author
  // should see this line.
  test("the registry yields a non-empty participant set", () => {
    expect(PARTICIPANTS.map((p) => p.jose)).toMatchSnapshot();
  });

  /**
   * ⚠ THE FLOOR. Every verdict above maps ANY throw to `"refused"`, so a shared
   * cause — a broken fixture key, a gate added to both kits, a renamed `sign` —
   * collapses both wires to the same wrong answer and every parity row agrees. A
   * blanket `throw` at the top of `JwsKit.sign` AND `CwsKit.sign` leaves the
   * relative rows GREEN; this row and the snapshots are what redden it.
   *
   * So one row asserts an ABSOLUTE verdict rather than a relative one: `cty` is
   * the parameter both wires are known to mint (JOSE `cty`, COSE label 3), stated
   * with a literal value and a literal label so the assertion survives a registry
   * edit and a resolver change. The snapshots below catch the same collapse, but
   * only until someone regenerates them; this line does not regenerate.
   */
  test("a parameter both wires mint is present on both — the collapse floor", () => {
    expect(joseVerdict("cty", "application/json")).toBe("present");
    expect(coseVerdict("cty", 3, "application/json")).toBe("present");
  });

  /**
   * ⚠ THE VERDICT PAIR IS SNAPSHOTTED, NOT JUST COMPARED. Comparing the two wires
   * to each other is satisfied by them AGREEING ON NOTHING HAPPENING, which is
   * what a collapse looks like. The frozen pair states what each wire actually
   * did, so a row that stops minting is a diff even while parity holds — and the
   * `toBe` keeps the invariant itself asserted, so a regenerated snapshot cannot
   * absorb a divergence.
   */
  test.each(PARTICIPANTS)(
    "$jose is present on both wires or absent from both — a real value",
    ({ jose, label, sample }) => {
      const verdicts = {
        jose: joseVerdict(jose, sample),
        cose: coseVerdict(jose, label, sample),
      };

      expect(verdicts).toMatchSnapshot();
      expect(verdicts.jose).toBe(verdicts.cose);
    },
  );

  // ⚠ THE EMPTY FORM IS THE FRAGILE HALF. A real value crosses the same tiers on
  // both wires; an empty one meets a PRUNE on the way, which is the step the two
  // encodings reach at different points.
  test.each(PARTICIPANTS.filter((p) => p.empty !== undefined))(
    "$jose is present on both wires or absent from both — the empty form",
    ({ jose, label, empty }) => {
      const verdicts = {
        jose: joseVerdict(jose, empty),
        cose: coseVerdict(jose, label, empty),
      };

      expect(verdicts).toMatchSnapshot();
      expect(verdicts.jose).toBe(verdicts.cose);
    },
  );
});
