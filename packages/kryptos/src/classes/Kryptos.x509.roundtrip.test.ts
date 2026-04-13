import {
  TEST_X509_INTERMEDIATE_PEM,
  TEST_X509_LEAF_B64_DER,
  TEST_X509_LEAF_PEM,
  TEST_X509_LEAF_PRIVATE_KEY_B64,
  TEST_X509_LEAF_PUBLIC_KEY_B64,
  TEST_X509_OTHER_PRIVATE_KEY_B64,
  TEST_X509_OTHER_PUBLIC_KEY_B64,
  TEST_X509_ROOT_PEM,
} from "../__fixtures__/x509";
import { KryptosError } from "../errors";
import { Kryptos } from "./Kryptos";
import { KryptosKit } from "./KryptosKit";

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  randomUUID: jest.fn().mockReturnValue("6e6f84b0-e125-5e3f-90ae-c65269668d98"),
}));

describe("Kryptos (X.509 round-trip)", () => {
  const fixedDates = {
    id: "3b9a051f-e1ec-562b-bf92-7cf92ec465ba",
    createdAt: new Date("2020-01-01T00:00:00.000Z"),
    notBefore: new Date("2020-01-01T00:00:00.000Z"),
    updatedAt: new Date("2020-01-01T00:00:00.000Z"),
  };

  const baseEcOptions = {
    ...fixedDates,
    algorithm: "ES256" as const,
    curve: "P-256" as const,
    type: "EC" as const,
    use: "sig" as const,
    isExternal: false,
    operations: ["sign", "verify"] as Array<"sign" | "verify">,
    privateKey: Buffer.from(TEST_X509_LEAF_PRIVATE_KEY_B64, "base64url"),
    publicKey: Buffer.from(TEST_X509_LEAF_PUBLIC_KEY_B64, "base64url"),
  };

  const buildKryptosWithChain = (): Kryptos =>
    new Kryptos({
      ...baseEcOptions,
      certificateChain: [
        TEST_X509_LEAF_PEM,
        TEST_X509_INTERMEDIATE_PEM,
        TEST_X509_ROOT_PEM,
      ],
    });

  describe("toDB → fromDb round-trip", () => {
    test("preserves certificateChain", () => {
      const kryptos = buildKryptosWithChain();
      const db = kryptos.toDB();

      expect(db).toMatchSnapshot();

      const restored = KryptosKit.from.db(db as any);

      expect(restored.x5c).toEqual(kryptos.x5c);
      expect(restored.x5t).toBe(kryptos.x5t);
      expect(restored.x5tS256).toBe(kryptos.x5tS256);
    });

    test("chain-less kryptos produces no certificateChain field", () => {
      const kryptos = new Kryptos(baseEcOptions);
      const db = kryptos.toDB();

      expect(db).not.toHaveProperty("certificateChain");

      const restored = KryptosKit.from.db(db as any);
      expect(restored.x5c).toBeUndefined();
    });
  });

  describe("toJSON → fromJwk round-trip", () => {
    test("preserves certificateChain via toJWK", () => {
      const kryptos = buildKryptosWithChain();
      const json = kryptos.toJSON();

      expect(json).toMatchSnapshot();
      expect(json.certificateChain).toHaveLength(3);
    });

    test("chain-less kryptos produces no certificateChain field in toJSON", () => {
      const kryptos = new Kryptos(baseEcOptions);
      const json = kryptos.toJSON();

      expect(json).not.toHaveProperty("certificateChain");
    });
  });

  describe("toJWK → fromJwk round-trip", () => {
    test("preserves chain via JWK x5c/x5t/x5t#S256", () => {
      const kryptos = buildKryptosWithChain();
      const jwk = kryptos.toJWK("public");

      expect(jwk).toMatchSnapshot();

      const restored = KryptosKit.from.jwk(jwk);
      expect(restored.x5c).toEqual(kryptos.x5c);
      expect(restored.x5t).toBe(kryptos.x5t);
      expect(restored.x5tS256).toBe(kryptos.x5tS256);
    });

    test("benign: fromJwk with only x5c (no thumbprints) succeeds", () => {
      const kryptos = buildKryptosWithChain();
      const jwk = kryptos.toJWK("public");
      const { x5t, "x5t#S256": x5tS256, ...stripped } = jwk;
      void x5t;
      void x5tS256;

      const restored = KryptosKit.from.jwk(stripped);

      expect(restored.x5c).toEqual(kryptos.x5c);
      expect(restored.x5t).toBe(kryptos.x5t);
      expect(restored.x5tS256).toBe(kryptos.x5tS256);
    });
  });

  describe("KryptosKit.clone", () => {
    test("preserves certificateChain", () => {
      const kryptos = buildKryptosWithChain();
      const cloned = KryptosKit.clone(kryptos);

      expect(cloned.x5c).toEqual(kryptos.x5c);
      expect(cloned.x5t).toBe(kryptos.x5t);
      expect(cloned.x5tS256).toBe(kryptos.x5tS256);
    });
  });

  describe("corruption", () => {
    test("fromDb with mismatched chain throws (leaf does not match key)", () => {
      const otherKryptos = new Kryptos({
        ...baseEcOptions,
        privateKey: Buffer.from(TEST_X509_OTHER_PRIVATE_KEY_B64, "base64url"),
        publicKey: Buffer.from(TEST_X509_OTHER_PUBLIC_KEY_B64, "base64url"),
      });
      const db = otherKryptos.toDB();
      const tampered = {
        ...db,
        certificateChain: [
          Buffer.from(TEST_X509_LEAF_B64_DER, "base64").toString("base64"),
        ],
      };

      expect(() => KryptosKit.from.db(tampered as any)).toThrow(KryptosError);
    });

    test("fromJwk with mismatched x5c throws", () => {
      const otherKryptos = new Kryptos({
        ...baseEcOptions,
        privateKey: Buffer.from(TEST_X509_OTHER_PRIVATE_KEY_B64, "base64url"),
        publicKey: Buffer.from(TEST_X509_OTHER_PUBLIC_KEY_B64, "base64url"),
      });
      const jwk = otherKryptos.toJWK("public");
      const tampered = {
        ...jwk,
        x5c: [Buffer.from(TEST_X509_LEAF_B64_DER, "base64").toString("base64")],
      };

      expect(() => KryptosKit.from.jwk(tampered)).toThrow(KryptosError);
    });

    test("fromJwk with tampered x5t#S256 throws", () => {
      const kryptos = buildKryptosWithChain();
      const jwk = kryptos.toJWK("public");
      const tampered = {
        ...jwk,
        "x5t#S256": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      };

      expect(() => KryptosKit.from.jwk(tampered)).toThrow(
        /x5t#S256 thumbprint does not match/,
      );
    });

    test("fromJwk with tampered x5t (SHA-1) throws", () => {
      const kryptos = buildKryptosWithChain();
      const jwk = kryptos.toJWK("public");
      const tampered = {
        ...jwk,
        x5t: "AAAAAAAAAAAAAAAAAAAAAAAAAAA",
      };

      expect(() => KryptosKit.from.jwk(tampered)).toThrow(
        /x5t thumbprint does not match/,
      );
    });
  });
});
