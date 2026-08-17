import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { Tag, decode as decodeCbor, encode as encodeCbor } from "cbor2";
import MockDate from "mockdate";
import { describe, expect, test } from "vitest";
import { CwmKit } from "../../classes/CwmKit.js";
import { CwsKit } from "../../classes/CwsKit.js";
import { CwtKit } from "../../classes/CwtKit.js";
import { JweKit } from "../../classes/JweKit.js";
import { JwsKit } from "../../classes/JwsKit.js";
import { JwtKit } from "../../classes/JwtKit.js";
import type { AegisError } from "../../errors/index.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

/**
 * ⭐ WHICH REFUSAL A DOUBLY-HOSTILE TOKEN GETS, on every wire that runs both
 * protected-header gates.
 *
 * SIX read paths run `rejectUnknownCritical` AND `assertAlgorithmMatch` over the
 * integrity-protected header before they spend a signature or AEAD cycle — three
 * JOSE kits, `CwsKit.verify`, and `verifyCwt` serving BOTH `CwtKit` and `CwmKit`.
 * That is six paths through four call sites, and `cwm` is the one a count of
 * files loses: it has no kit of its own here and its verdict changed anyway. Both
 * gates refuse, so a token that trips BOTH — a `crit` naming an extension aegis
 * does not implement, under an `alg` that is not the resolved key's — is answered
 * by whichever gate the kit happens to run first. That ORDER is observable output
 * and nothing else in the package states it.
 *
 * ⚠ Every OTHER test in the package trips ONE gate at a time, which is exactly
 * why the two wires were able to disagree about the order behind comments
 * asserting they could not: a single-gate test passes under either order. This
 * file was written BEFORE the pair was unified, and it recorded the divergence —
 * three JOSE `*_unsupported_crit_param` verdicts against three COSE
 * `*_algorithm_mismatch` ones. The three COSE verdicts are the ones that changed
 * when `assertProtectedHeaderGates` made the order one thing; the three JOSE ones
 * are unchanged, which is what says the unification moved nothing it did not have
 * to. ⚠ Only five rows existed when the freeze was taken, so `cwm`'s change was
 * unpinned; its snapshot below was written after the fact and is therefore the
 * one row whose pre-unification value rests on the reasoning above rather than on
 * a measurement — the order-flip check is what holds it.
 *
 * The `alg` mismatch comes from minting with one key and verifying with a second
 * of the same class and a different algorithm. ⚠ Both keys in a pair share an
 * `id`, so the `kid` fail-fast on `JwtKit`/`verifyCwt` cannot answer first — the
 * token has to reach the pair being pinned.
 *
 * ⚠ THE HOSTILE `crit` IS INJECTED AFTER THE MINT, and it has to be, because
 * AEGIS CAN NO LONGER PRODUCE ONE. The mint gate
 * (`internal/header/assert-crit-eligible.ts`) refuses a `crit` naming anything
 * outside the header registry's eligible set, which is exactly its purpose — a
 * token aegis mints is a token aegis verifies — so a doubly-hostile token is by
 * construction something only a FOREIGN producer writes. This file writes one.
 * The `crit` used to ride the caller's header bag; that shape now fails at the
 * mint and would never reach a verify at all.
 */
describe("the protected-header gates, on a token that trips BOTH", () => {
  const logger = createMockLogger();

  const WIRE_CLAIMS = { iss: "https://issuer.lindorm.io/", sub: "user-1" };

  /**
   * The hostile pair, written into the protected header of an ALREADY MINTED
   * token: a `crit` naming a parameter aegis has no registry entry for, beside
   * the parameter itself so the header is otherwise well-formed.
   *
   * ⚠ The two wires reach the crit gate through DIFFERENT branches of it, and
   * that is a fact about the COSE READ rather than about this file. On JOSE a
   * decoded protected header carries unregistered keys verbatim, so `ext` is
   * present, `validateCrit` passes it, and the ELIGIBILITY branch answers
   * (`*_unsupported_crit_param`). On COSE an unregistered LABEL has no JOSE wire
   * name and is dropped on the way in (`internal/header/cose-wire-header.ts`), so
   * the same token reads as a `crit` naming a parameter the header does not carry
   * and the MALFORMED branch answers (`*_invalid_crit`). Both are
   * `rejectUnknownCritical`, which is the gate whose ORDER this file pins; which
   * of its two branches fires is not.
   *
   * ⚠ The SIGNATURE IS LEFT BROKEN on purpose, and the rows stay honest: both
   * gates run on the decoded protected header BEFORE any signature or AEAD cycle,
   * which is the property the whole file is about. A row that reached the crypto
   * would be asserting about a different check entirely.
   */
  const HOSTILE_CRIT_JOSE = { crit: ["ext"], ext: "x" };

  /** The COSE `crit` label (RFC 9052 §3.1 Table 3). */
  const COSE_CRIT_LABEL = 2;

  /** JOSE: rewrite the compact serialisation's first segment. */
  const injectJose = (token: string, hostile: boolean): string => {
    if (!hostile) return token;

    const parts = token.split(".");
    const header = JSON.parse(Buffer.from(parts[0]!, "base64url").toString("utf8"));

    parts[0] = Buffer.from(
      JSON.stringify({ ...header, ...HOSTILE_CRIT_JOSE }),
      "utf8",
    ).toString("base64url");

    return parts.join(".");
  };

  /**
   * COSE: rewrite the protected bstr inside the structure array, re-wrapping the
   * tag chain it was found under. ⚠ The COSE kits take and return BYTES, not a
   * compact string, so this hands back a `Buffer`.
   */
  const injectCose = (token: Buffer, hostile: boolean): Buffer => {
    if (!hostile) return token;

    let value: unknown = decodeCbor(token);
    const tags: Array<number> = [];

    while (value instanceof Tag) {
      tags.push(Number(value.tag));
      value = value.contents;
    }

    const structure = [...(value as Array<unknown>)];
    const bucket = decodeCbor(structure[0] as Uint8Array) as Map<unknown, unknown>;

    bucket.set(COSE_CRIT_LABEL, ["ext"]);
    bucket.set("ext", "x");
    structure[0] = encodeCbor(bucket);

    let wrapped: unknown = structure;
    for (const tag of tags.reverse()) wrapped = new Tag(tag, wrapped);

    return Buffer.from(encodeCbor(wrapped));
  };

  const thrownBy = (fn: () => unknown): AegisError => {
    try {
      fn();
    } catch (error) {
      return error as AegisError;
    }

    throw new Error("the token was ACCEPTED — the gate under test never fired");
  };

  /** A signing pair: same key id, same algClass, different algorithm. */
  const signPair = (id: string) => ({
    minted: KryptosKit.generate.sig.ec({ algorithm: "ES512", id }),
    reader: KryptosKit.generate.sig.ec({ algorithm: "ES256", id }),
  });

  /**
   * A MAC pair: same key id, both symmetric, different algorithm.
   *
   * ⚠ `oct` on purpose. `CwmKit` gates its key's `algClass` in the constructor, and
   * the structure tag follows the key — a symmetric key is a COSE_Mac0 (tag 17),
   * which is the whole reason `cwm` is a read path of its own rather than a
   * spelling of `cwt`.
   */
  const macPair = (id: string) => ({
    minted: KryptosKit.generate.sig.oct({ algorithm: "HS512", id }),
    reader: KryptosKit.generate.sig.oct({ algorithm: "HS256", id }),
  });

  /** An encryption pair: same key id, same key type, different key management. */
  const encryptPair = (id: string) => ({
    minted: KryptosKit.generate.enc.ec({
      algorithm: "ECDH-ES",
      encryption: "A256GCM",
      id,
    }),
    reader: KryptosKit.generate.enc.ec({
      algorithm: "ECDH-ES+A256KW",
      encryption: "A256GCM",
      id,
    }),
  });

  /**
   * Each row drives ONE wire and hands back the refusal. It is called TWICE per
   * test: once on the token as minted (only the alg gate can fire) and once with
   * the hostile `crit` injected (both can), which is what makes the order
   * observable.
   */
  const verdicts: ReadonlyArray<{
    format: string;
    refuse: (hostile: boolean) => AegisError;
  }> = [
    {
      format: "jws",
      refuse: (hostile) => {
        const { minted, reader } = signPair("key_hostile_jws");
        const token = new JwsKit({ kryptos: minted, logger }).sign("hostile");

        return thrownBy(() =>
          new JwsKit({ kryptos: reader, logger }).verify(injectJose(token, hostile)),
        );
      },
    },
    {
      format: "jwt",
      refuse: (hostile) => {
        const { minted, reader } = signPair("key_hostile_jwt");
        const token = new JwtKit({ kryptos: minted, logger }).sign(WIRE_CLAIMS);

        return thrownBy(() =>
          new JwtKit({ kryptos: reader, logger }).verify(injectJose(token, hostile)),
        );
      },
    },
    {
      format: "jwe",
      refuse: (hostile) => {
        const { minted, reader } = encryptPair("key_hostile_jwe");
        const token = new JweKit({ kryptos: minted, logger }).encrypt("hostile");

        return thrownBy(() =>
          new JweKit({ kryptos: reader, logger }).decrypt(injectJose(token, hostile)),
        );
      },
    },
    {
      format: "cws",
      refuse: (hostile) => {
        const { minted, reader } = signPair("key_hostile_cws");
        const token = new CwsKit({ kryptos: minted, logger }).sign(
          Buffer.from("hostile"),
        );

        return thrownBy(() =>
          new CwsKit({ kryptos: reader, logger }).verify(injectCose(token, hostile)),
        );
      },
    },
    {
      format: "cwt",
      refuse: (hostile) => {
        const { minted, reader } = signPair("key_hostile_cwt");
        const token = new CwtKit({ kryptos: minted, logger }).sign(WIRE_CLAIMS);

        return thrownBy(() =>
          new CwtKit({ kryptos: reader, logger }).verify(injectCose(token, hostile)),
        );
      },
    },
    {
      // ⚠ THE ROW THAT WAS MISSING, and it is the one that most needed to be
      // here: `cwm`'s verdict CHANGED when the order was unified, yet it has no
      // kit of its own on this path — `CwmKit.verify` delegates to `verifyCwt`,
      // which `CwtKit` also uses — so counting call sites or files loses it.
      format: "cwm",
      refuse: (hostile) => {
        const { minted, reader } = macPair("key_hostile_cwm");
        const token = new CwmKit({ kryptos: minted, logger }).sign(WIRE_CLAIMS);

        return thrownBy(() =>
          new CwmKit({ kryptos: reader, logger }).verify(injectCose(token, hostile)),
        );
      },
    },
  ];

  test.each(verdicts)(
    "$format answers a crit-hostile, alg-mismatched token",
    ({ format, refuse }) => {
      // ⚠ THE CONTROL, and the pin is worthless without it. The snapshot below
      // records WHICH gate answers a token that trips BOTH — but a token that
      // trips only ONE produces the same snapshot, so nothing in a lone snapshot
      // says the alg gate was ever in the running. Drive an identically
      // CONFIGURED pair — the helpers generate fresh material per call, so it is
      // the same algorithms and the same shared id, not the same bytes — with no
      // crit injected first: the alg gate must fire on its own. If a future
      // edit stops `signPair`/`encryptPair` producing a real mismatch, this goes
      // red here rather than leaving five green snapshots pinning an order the
      // file no longer observes.
      expect(
        refuse(false).code,
        "the key pair no longer produces an algorithm mismatch, so the snapshot below proves nothing about ORDER",
      ).toBe(`${format}_algorithm_mismatch`);

      // Now BOTH gates are live, and the snapshot records which one wins.
      const error = refuse(true);

      // The CLASS as well as the code: the code names the gate, the class names
      // which leaf the wire raises it under, and step-order changes can move either.
      expect({ error: error.constructor.name, code: error.code }).toMatchSnapshot();
    },
  );
});
