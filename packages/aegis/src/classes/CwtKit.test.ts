import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { AegisError } from "../errors/index.js";
import {
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_SIG,
  TEST_OKP_KEY_SIG,
} from "../__fixtures__/keys.js";
import { CwtKit } from "./CwtKit.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

// The kit is WIRE-ONLY and TRANSFORM-FREE: `sign` serializes an already
// COSE-name-keyed claim dict verbatim; `verify` returns the native WIRE payload
// (`sub`/`cti`, not the domain `subject`/`tokenId`). The domain⇆wire translation
// is the Aegis-side CoseKit boundary, never the kit.
const wire = {
  iss: "https://issuer.lindorm.io/",
  sub: "user-1",
  aud: ["https://rs.lindorm.io/"],
  exp: 1704099600, // 2024-01-01T09:00:00Z — future of the mocked 08:00
  iat: 1704092400, // 2024-01-01T06:00:00Z — past
  cti: "the-cti",
  client_id: "client-1",
  scope: ["read", "write"],
};

describe("CwtKit (COSE_Sign1, asymmetric)", () => {
  let kit: CwtKit;

  beforeEach(() => {
    kit = new CwtKit({ logger: createMockLogger(), kryptos: TEST_EC_KEY_SIG });
  });

  test("mints a CWT tagged with the CWT tag (61 = 0xd83d)", () => {
    const token = kit.sign(wire, { tokenType: "at" });
    expect(Buffer.isBuffer(token)).toBe(true);
    // CBOR tag 61 = 0xd8 0x3d
    expect(token.subarray(0, 2).toString("hex")).toBe("d83d");
  });

  test("round-trips the WIRE claims through sign -> verify (no domain translation)", () => {
    const { payload: claims, header } = kit.verify(kit.sign(wire, { tokenType: "at" }));

    // WIRE names only — jose/cose keys, NOT domain (`issuer`/`subject`/`tokenId`).
    expect(claims.iss).toBe("https://issuer.lindorm.io/");
    expect(claims.sub).toBe("user-1");
    expect(claims.aud).toEqual(["https://rs.lindorm.io/"]);
    expect(claims.cti).toBe("the-cti");
    expect(claims.client_id).toBe("client-1");
    expect(claims.scope).toEqual(["read", "write"]);
    // Temporal claims decode to Dates (the codec's "date" kind).
    expect(claims.exp).toEqual(new Date(1704099600 * 1000));
    expect(claims.iat).toEqual(new Date(1704092400 * 1000));
    expect(header.typ).toBe("application/at+cwt");
  });

  test("decode exposes kid / alg / typ without verifying", () => {
    const decoded = CwtKit.decode(kit.sign(wire, { tokenType: "at" }));

    expect(decoded.header.kid).toBe(TEST_EC_KEY_SIG.id);
    expect(decoded.header.alg).toBe("ES512"); // TEST_EC_KEY_SIG is P-521
    expect(decoded.header.typ).toBe("application/at+cwt");
  });

  test("rejects a tampered payload", () => {
    const token = kit.sign(wire);
    token[token.length - 5] ^= 0xff; // flip a signature byte
    expect(() => kit.verify(token)).toThrow(AegisError);
  });

  describe("integrity gate — COSE_Sign1 requires an asymmetric key", () => {
    test("throws when handed a symmetric (oct) key", () => {
      expect(
        () => new CwtKit({ logger: createMockLogger(), kryptos: TEST_OCT_KEY_SIG }),
      ).toThrow(AegisError);
    });

    test("the throw carries the cwt_requires_asymmetric_key code", () => {
      const error = (() => {
        try {
          new CwtKit({ logger: createMockLogger(), kryptos: TEST_OCT_KEY_SIG });
        } catch (err) {
          return err as AegisError;
        }
      })();

      expect(error?.code).toBe("cwt_requires_asymmetric_key");
    });
  });

  test("kid fail-fast — a token naming a different kid throws cwt_kid_mismatch", () => {
    const token = kit.sign(wire);
    const otherKit = new CwtKit({
      logger: createMockLogger(),
      kryptos: TEST_OKP_KEY_SIG, // asymmetric, different id
    });

    const error = (() => {
      try {
        otherKit.verify(token);
      } catch (err) {
        return err as AegisError;
      }
    })();

    expect(error?.code).toBe("cwt_kid_mismatch");
  });

  describe("ML-DSA is official COSE (RFC 9964)", () => {
    // ML-DSA (post-quantum) is asymmetric — a valid COSE_Sign1 key — and now
    // IANA-registered (RFC 9964, ML-DSA-44 = -48). A plain (non-proprietary) CWT
    // sign is accepted and round-trips; no proprietary flag is required. The gate
    // runs through signCwt -> CwsKit; the enc-side (AES-CBC-HMAC) gate still
    // covers the proprietary mechanism.
    const mldsa = KryptosKit.generate.sig.akp({ algorithm: "ML-DSA-44" });

    test("non-proprietary sign is accepted and round-trips the WIRE claims", () => {
      const mldsaKit = new CwtKit({ logger: createMockLogger(), kryptos: mldsa });

      const { header, payload: claims } = mldsaKit.verify(
        mldsaKit.sign(wire, { tokenType: "at" }),
      );

      expect(header.alg).toBe("ML-DSA-44");
      expect(claims.iss).toBe("https://issuer.lindorm.io/");
      expect(claims.cti).toBe("the-cti");
    });
  });

  describe("caller-controlled protected / unprotected header bags", () => {
    test("header params land protected, unprotected params unprotected — both merge on verify", () => {
      const x5u = "https://certs.lindorm.io/leaf.pem";
      const { header } = kit.verify(
        kit.sign(wire, {
          tokenType: "at",
          header: { cty: "application/example" },
          unprotected: { x5u },
        }),
      );

      expect(header.cty).toBe("application/example");
      expect(header.x5u).toBe(x5u);
      // The always-present derived params are still there.
      expect(header.typ).toBe("application/at+cwt");
      expect(header.alg).toBe("ES512");
      expect(header.kid).toBe(TEST_EC_KEY_SIG.id);
    });

    test("a derived param (alg) smuggled into the bag throws cose_reserved_header", () => {
      const error = (() => {
        try {
          kit.sign(wire, { header: { alg: "ES256" } as never });
        } catch (err) {
          return err as AegisError;
        }
      })();

      expect(error?.code).toBe("cose_reserved_header");
    });
  });

  describe("temporal-in-kit (R10)", () => {
    // The wire kit range-checks exp/nbf/iat against "now" with clock tolerance,
    // validated IF PRESENT — exactly as JwtKit does.
    test("rejects an expired token (exp in the past)", () => {
      const token = kit.sign({ ...wire, exp: 1704092400 }); // 06:00, now is 08:00
      expect(() => kit.verify(token)).toThrow(/Invalid token/);
    });

    test("accepts an expired token within clock tolerance", () => {
      const tolerant = new CwtKit({
        logger: createMockLogger(),
        kryptos: TEST_EC_KEY_SIG,
        clockTolerance: 7200,
      });
      const token = tolerant.sign({ ...wire, exp: 1704092400 });
      expect(() => tolerant.verify(token)).not.toThrow();
    });
  });

  // R10 temporal overrides — mocked "now" is 2024-01-01T08:00:00Z (unix 1704096000).
  describe("temporal overrides (R10 — currentDate / maxTokenAge)", () => {
    test("currentDate overrides now: an expired CWT verifies against a past currentDate", () => {
      // iat 06:00, exp 07:30 — expired against the mocked 08:00 now.
      const token = kit.sign({ ...wire, iat: 1704088800, exp: 1704094200 });
      expect(() => kit.verify(token)).toThrow();

      // Against a currentDate of 07:00 the exp (07:30) is still in the future and
      // the iat (06:00) is still in the past, so the token verifies.
      expect(() =>
        kit.verify(token, undefined, { currentDate: new Date(1704092400 * 1000) }),
      ).not.toThrow();
    });

    test("maxTokenAge accepts a fresh iat and rejects a stale one", () => {
      // iat 60s ago (07:59).
      const fresh = kit.sign({ ...wire, iat: 1704095940, exp: 1704099600 });
      expect(() => kit.verify(fresh, undefined, { maxTokenAge: 300 })).not.toThrow();

      // iat 10 minutes ago (07:50) — older than the 5-minute maxTokenAge.
      const stale = kit.sign({ ...wire, iat: 1704095400, exp: 1704099600 });
      expect(() => kit.verify(stale, undefined, { maxTokenAge: 300 })).toThrow();
    });
  });
});
