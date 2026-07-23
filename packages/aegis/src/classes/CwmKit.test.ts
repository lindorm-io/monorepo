import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { AegisError } from "../errors/index.js";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
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
    expect(decoded.algorithm).toBe("HS256"); // HMAC -> COSE_Mac0, never Sign1
    expect(decoded.kid).toBe(kryptos.id);
    expect(decoded.typ).toBe("application/at+cwt");
  });

  test("round-trips the WIRE claims through sign -> verify (no domain translation)", () => {
    const { payload: claims, header } = kit.verify(kit.sign(wire, { tokenType: "at" }));

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
