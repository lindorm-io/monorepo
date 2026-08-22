import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { HEADER_SPECS, headerJoseName } from "./header-registry.js";
import {
  isSpecDefinedHeaderParam,
  registeredJoseNames,
  unimplementedSpecParams,
} from "./is-spec-defined-header-param.js";

/** The committed IANA registry snapshot — the only external input this predicate has. */
const SNAPSHOT = new URL(
  "../../__fixtures__/iana/jose-header-parameters.csv",
  import.meta.url,
);

/**
 * The snapshot's provenance, CHECKED rather than asserted in prose. A fixture a
 * test derives from is only as good as the claim about where it came from, and
 * that claim is otherwise checkable against nothing.
 */
const SOURCE = {
  url: "https://www.iana.org/assignments/jose/web-signature-encryption-header-parameters.csv",
  fetchedAt: "2026-08-19",
  sha256: "e66121e940ab248a4a60c58534c15f7d92f86e4974b5812af4928f053d99e617",
};

/** Every `Header Parameter Name` in the snapshot, de-duplicated, order-insensitive. */
const ianaNames = (): ReadonlyArray<string> => {
  const [, ...rows] = readFileSync(SNAPSHOT, "utf8").trim().split("\n");

  // The name is the FIRST field and IANA never quotes it (no name contains a
  // comma); the later `Reference` field does contain quoted commas, which is why
  // only the first field is taken rather than the row being split wholesale.
  return [...new Set(rows.map((row) => row.split(",")[0]!.trim()).filter(Boolean))];
};

/**
 * The ONE answer to "does a public specification define this header parameter",
 * and the bindings that keep its two halves honest.
 */
describe("isSpecDefinedHeaderParam", () => {
  test("the committed IANA snapshot is the file this suite claims it is", () => {
    const digest = createHash("sha256").update(readFileSync(SNAPSHOT)).digest("hex");

    expect(
      digest,
      `the snapshot no longer matches the sha256 recorded for ${SOURCE.url} (taken ${SOURCE.fetchedAt}) — re-derive the set below and update both`,
    ).toBe(SOURCE.sha256);
  });

  /**
   * ⭐ DERIVED, NEVER MIRRORED — the whole point of committing the snapshot. The
   * hand-written half of the predicate must be EXACTLY the registered names the
   * header registry does not answer for: an entry the registry also carries is a
   * second opinion about one parameter, and a registered name in NEITHER is a
   * hole (that is how `iss`/`sub`/`aud` were forgeable through `custom` —
   * RFC 7519 §10.4.1, RFC 7519 §5.3).
   */
  test("the hand-written half is exactly IANA minus the header registry", () => {
    const registered = new Set(registeredJoseNames());
    const expected = ianaNames()
      .filter((name) => !registered.has(name))
      .sort();

    expect([...unimplementedSpecParams()].sort()).toEqual(expected);
  });

  /**
   * ⭐ THE REGISTRY HALF READS `spec`, NOT `critEligible`. The two columns agree
   * on every row today, so a test comparing outcomes alone would pass either way
   * — this one names the column by constructing the answer from it.
   *
   * ⛔ Reading `critEligible` would be wrong even while it agrees: RFC 7797 §6
   * requires `crit: ["b64"]` on a conformant unencoded-payload JWS, so
   * implementing `b64` means marking it crit-eligible, which would flip a
   * parameter RFC 7797 DEFINES to "not spec-defined" and reopen the hole.
   */
  test("every registry row except the ones lindorm owns is spec-defined", () => {
    // ⛔ THE POLICY SET IS FROZEN BY NAME, not merely asserted non-empty.
    // `SpecCitation` has three arms — `rfc | oidc | policy` — so a parameter a
    // PUBLIC document defines that is neither an RFC nor an OpenID spec (an ETSI
    // TS, an IETF draft, a W3C note) has no arm to declare but `policy`, and this
    // predicate would then answer `false` for it. `custom` stays safe either way
    // (the IANA half still refuses a registered name), but `crit` would admit it
    // the moment its `critEligible` cell were `true`. Freezing the set makes
    // adding a `policy` row a decision someone has to take here.
    const byPolicy = HEADER_SPECS.filter((spec) => spec.spec.kind === "policy").map(
      (spec) => headerJoseName(spec),
    );

    expect(
      byPolicy.sort(),
      "a new `spec.kind: policy` row is exempt from the spec-defined rule — confirm it is lindorm's own and not a public document with no arm in `SpecCitation`",
    ).toEqual(["oid"]);

    for (const spec of HEADER_SPECS) {
      expect(
        isSpecDefinedHeaderParam(
          spec.wire.jose.kind === "name" ? spec.wire.jose.name : "",
        ),
        `${spec.domain} disagrees with its own \`spec\` column`,
      ).toBe(spec.spec.kind !== "policy");
    }
  });

  test.each(["iss", "sub", "aud", "client_id", "b64", "trust_chain"])(
    "a registered parameter aegis does not implement (%s) answers true",
    (name) => {
      expect(isSpecDefinedHeaderParam(name)).toBe(true);
    },
  );

  test.each(["x-lindorm-hint", "my-extension", "oid"])(
    "a name a producer may invent (%s) answers false",
    (name) => {
      expect(isSpecDefinedHeaderParam(name)).toBe(false);
    },
  );

  // ⚠ `headerByJose` is a `Map` read and the set is a `Set`, so a
  // CALLER-CONTROLLED name cannot resolve through `Object.prototype`. `crit`
  // members and `custom` keys both reach this predicate.
  test.each(["toString", "constructor", "valueOf", "hasOwnProperty", "__proto__"])(
    "an Object.prototype member (%s) answers false",
    (name) => {
      expect(isSpecDefinedHeaderParam(name)).toBe(false);
    },
  );

  test("a non-string is not a parameter name", () => {
    for (const value of [1, null, undefined, {}, []]) {
      expect(isSpecDefinedHeaderParam(value)).toBe(false);
    }
  });
});
