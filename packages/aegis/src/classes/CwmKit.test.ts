import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { AegisError, CwmError, CwsError } from "../errors/index.js";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import { Tag, decodeCbor, encodeCbor } from "../internal/cose/cbor.js";
import { COSE_TAG } from "../internal/cose/structures.js";
import { CwmKit } from "./CwmKit.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

// The COSE_Mac0 twin of CwtKit — same WIRE-ONLY, TRANSFORM-FREE shape, secured
// by an HMAC instead of a signature.
const wire = {
  iss: "https://issuer.lindorm.io/",
  sub: "user-1",
  aud: ["client-1"],
  exp: 1704099600, // 2024-01-01T09:00:00Z — future of the mocked 08:00
  iat: 1704092400, // 2024-01-01T06:00:00Z — past
  cti: "the-cti",
  client_id: "client-1",
};

describe("CwmKit (COSE_Mac0, symmetric)", () => {
  const kryptos = KryptosKit.generate.sig.oct({ algorithm: "HS256" });

  let kit: CwmKit;

  beforeEach(() => {
    kit = new CwmKit({ logger: createMockLogger(), kryptos });
  });

  test("MACs a CWT tagged with the CWT tag (61 = 0xd83d), HS256", () => {
    const token = kit.sign(wire, { tokenType: "at" });

    expect(token.subarray(0, 2).toString("hex")).toBe("d83d");
    const decoded = CwmKit.decode(token);
    expect(decoded.protectedHeader.alg).toBe("HS256"); // HMAC -> COSE_Mac0, never Sign1
    expect(decoded.unprotectedHeader.kid).toBe(kryptos.id);
    expect(decoded.protectedHeader.typ).toBe("application/at+cwt");
  });

  test("round-trips the WIRE claims through sign -> verify (no domain translation)", () => {
    const { payload: claims, protectedHeader: header } = kit.verify(
      kit.sign(wire, { tokenType: "at" }),
    );

    expect(claims.iss).toBe("https://issuer.lindorm.io/");
    expect(claims.sub).toBe("user-1");
    expect(claims.aud).toEqual(["client-1"]);
    expect(claims.cti).toBe("the-cti");
    expect(claims.client_id).toBe("client-1");
    expect(claims.exp).toEqual(new Date(1704099600 * 1000));
    expect(claims.iat).toEqual(new Date(1704092400 * 1000));
    expect(header.typ).toBe("application/at+cwt");
  });

  test("rejects a tampered payload", () => {
    const token = kit.sign(wire);
    token[token.length - 5] ^= 0xff; // flip a MAC byte
    expect(() => kit.verify(token)).toThrow(AegisError);
  });

  describe("integrity gate — COSE_Mac0 requires a symmetric key", () => {
    test("throws when handed an asymmetric key", () => {
      expect(
        () => new CwmKit({ logger: createMockLogger(), kryptos: TEST_EC_KEY_SIG }),
      ).toThrow(AegisError);
    });

    test("the throw carries the cwm_requires_symmetric_key code", () => {
      const error = (() => {
        try {
          new CwmKit({ logger: createMockLogger(), kryptos: TEST_EC_KEY_SIG });
        } catch (err) {
          return err as AegisError;
        }
      })();

      expect(error?.code).toBe("cwm_requires_symmetric_key");
    });
  });

  test("kid fail-fast — a token naming a different kid throws cwm_kid_mismatch", () => {
    const token = kit.sign(wire);
    const otherKit = new CwmKit({
      logger: createMockLogger(),
      kryptos: KryptosKit.generate.sig.oct({ algorithm: "HS256" }), // different id
    });

    const error = (() => {
      try {
        otherKit.verify(token);
      } catch (err) {
        return err as AegisError;
      }
    })();

    expect(error?.code).toBe("cwm_kid_mismatch");
    // ⚠ THE TITLE, and specifically the `CWM` in it. The refusal is built from
    // the format tag, the way the algorithm-match refusal already was, so a
    // COSE_Mac0 no longer reports itself as a CWT. Nothing else in the package
    // asserts either title, which is why the spelling could change unobserved.
    expect(error?.title).toBe("CWM Kid Mismatch");
  });

  test("typ mismatch — the refusal names CWM, not CWT", () => {
    const token = kit.sign(wire, { tokenType: "at" });

    const error = (() => {
      try {
        kit.verify(token, undefined, { tokenType: "rt" });
      } catch (err) {
        return err as AegisError;
      }
    })();

    expect(error?.code).toBe("cwm_typ_mismatch");
    expect(error?.title).toBe("CWM Typ Mismatch");

    // The control: the typ the kit actually stamped is accepted.
    expect(() => kit.verify(token, undefined, { tokenType: "at" })).not.toThrow();
  });

  describe("temporal-in-kit (R10)", () => {
    test("rejects an expired token (exp in the past)", () => {
      const token = kit.sign({ ...wire, exp: 1704092400 }); // 06:00, now is 08:00
      expect(() => kit.verify(token)).toThrow(/Invalid token/);
    });

    test("accepts an expired token within clock tolerance", () => {
      const tolerant = new CwmKit({
        logger: createMockLogger(),
        kryptos,
        clockTolerance: 7200,
      });
      const token = tolerant.sign({ ...wire, exp: 1704092400 });
      expect(() => tolerant.verify(token)).not.toThrow();
    });
  });
});

/**
 * The MAC half of the claims core.
 *
 * ⚠ Covered INCIDENTALLY before: the claims core built its COSE structure by
 * constructing `CwsKit`, so a symmetric key reached the Mac0 branch of a body
 * `CwsKit.test.ts` drove. The claims core composes the same utilities itself now,
 * so the two things only a SYMMETRIC key can reach on this wire — the Mac0
 * structure and the MAC-invalid refusal — need their own evidence here.
 *
 * The header RULES are one shared call site and are pinned once, on `CwtKit`.
 * The header refusal's CLASS is not: it comes from `ERROR_BY_FORMAT[format]`,
 * and `cwm` is the one format nothing else drives, so one refusal is taken end
 * to end here to prove this kit passes its own tag rather than the `cwt` one.
 */
describe("CwmKit — the COSE_Mac0 it builds and the refusal only a MAC can raise", () => {
  const kryptos = KryptosKit.generate.sig.oct({ algorithm: "HS256" });
  const kit = new CwmKit({ logger: createMockLogger(), kryptos });

  test("the structure inside the CWT tag (61) is a COSE_Mac0 (tag 17)", () => {
    // Both claims kits stamp the same `+cwt` media type, so the STRUCTURE is the
    // only thing that says a MAC secured this token rather than a signature.
    const outer = decodeCbor<Tag>(kit.sign(wire, { tokenType: "at" }));

    expect(outer.tag).toBe(COSE_TAG.cwt);
    expect((outer.contents as Tag).tag).toBe(COSE_TAG.mac0);
  });

  test("a tampered payload is refused as an invalid MAC, not an invalid signature", () => {
    const token = kit.sign(wire);
    const outer = decodeCbor<Tag>(token);
    const contents = (outer.contents as Tag).contents as Array<Uint8Array>;
    const payload = Buffer.from(contents[2]);
    payload[0] ^= 0xff;
    contents[2] = payload;

    let thrown: AegisError | undefined;
    try {
      kit.verify(encodeCbor(outer));
    } catch (error) {
      thrown = error as AegisError;
    }

    expect(thrown).toBeInstanceOf(CwsError);
    expect(thrown?.code).toBe("cose_mac_invalid");
  });

  test("a reserved param in the caller's bag is refused under the cwm class", () => {
    // The code and the words are byte-identical on all three signed COSE wires;
    // only the class says which one raised it, so asserting the code alone would
    // stay green with the `cwt` (or `cws`) error threaded through this kit.
    let thrown: AegisError | undefined;
    try {
      kit.sign(wire, { header: { typ: "application/x+cwt" } as never });
    } catch (error) {
      thrown = error as AegisError;
    }

    expect(thrown).toBeInstanceOf(CwmError);
    expect(thrown?.code).toBe("cose_reserved_header");
  });
});

/**
 * The algorithm-match gate under the `cwm` tag — the symmetric third of the
 * threading the shared `assertAlgorithmMatch` does for the signed COSE formats.
 */
describe("CwmKit — the algorithm-match gate answers under the cwm tag", () => {
  test("refuses a token whose protected alg is not the configured key's", () => {
    // ⚠ Shared id: the kid fail-fast runs first and would otherwise answer
    // `cwm_kid_mismatch` before the algorithm gate is reached.
    const id = "key_algorithm_match_cwm";

    const signer = new CwmKit({
      logger: createMockLogger(),
      kryptos: KryptosKit.generate.sig.oct({ algorithm: "HS256", id }),
    });
    const verifier = new CwmKit({
      logger: createMockLogger(),
      kryptos: KryptosKit.generate.sig.oct({ algorithm: "HS512", id }),
    });

    const token = signer.sign(wire, { tokenType: "at" });

    let thrown: AegisError | undefined;

    try {
      verifier.verify(token);
    } catch (error) {
      thrown = error as AegisError;
    }

    expect(thrown).toBeInstanceOf(CwmError);
    expect(thrown?.code).toBe("cwm_algorithm_mismatch");
    expect(thrown?.title).toBe("CWM Algorithm Mismatch");
    expect(thrown?.data).toEqual({ algorithm: "HS256" });
  });
});
