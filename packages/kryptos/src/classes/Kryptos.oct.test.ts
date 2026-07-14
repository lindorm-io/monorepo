import MockDate from "mockdate";
import { TEST_OCT_KEY_B64 } from "../__fixtures__/oct-keys.js";
import { KryptosError } from "../errors/index.js";
import { KryptosKit } from "./KryptosKit.js";
import { beforeEach, describe, expect, test } from "vitest";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate.toISOString());

describe("Kryptos (oct)", () => {
  let options: any;

  beforeEach(() => {
    options = {
      id: "3b9a051f-e1ec-562b-bf92-7cf92ec465ba",
      createdAt: new Date("2023-01-01T08:00:00.000Z"),
      expiresAt: new Date("2099-01-01T08:00:00.000Z"),
      internal: true,
      issuer: "https://example.com",
      jwksUri: "https://example.com/.well-known/jwks.json",
      notBefore: new Date("2023-01-01T08:00:00.000Z"),
      ownerId: "f02c2d0c-44ee-5e4e-8b3b-39d46924d227",
      purpose: "test",
    };
  });

  describe("metadata", () => {
    test("should return attribute values", () => {
      const kryptos = KryptosKit.from.b64({ ...TEST_OCT_KEY_B64, ...options });

      expect(kryptos.id).toEqual("3b9a051f-e1ec-562b-bf92-7cf92ec465ba");
      expect(kryptos.algorithm).toEqual("HS512");
      expect(kryptos.createdAt).toEqual(new Date("2023-01-01T08:00:00.000Z"));
      expect(kryptos.curve).toEqual(null);
      expect(kryptos.expiresAt).toEqual(new Date("2099-01-01T08:00:00.000Z"));
      expect(kryptos.expiresIn).toEqual(2366841600);
      expect(kryptos.isActive).toEqual(true);
      expect(kryptos.isExpired).toEqual(false);
      expect(kryptos.internal).toEqual(true);
      expect(kryptos.issuer).toEqual("https://example.com");
      expect(kryptos.jwksUri).toEqual("https://example.com/.well-known/jwks.json");
      expect(kryptos.modulus).toEqual(null);
      expect(kryptos.notBefore).toEqual(new Date("2023-01-01T08:00:00.000Z"));
      expect(kryptos.operations).toEqual(["sign", "verify"]);
      expect(kryptos.ownerId).toEqual("f02c2d0c-44ee-5e4e-8b3b-39d46924d227");
      expect(kryptos.purpose).toEqual("test");
      expect(kryptos.type).toEqual("oct");
      expect(kryptos.use).toEqual("sig");

      expect(kryptos.hasPrivateKey).toEqual(true);
      expect(kryptos.hasPublicKey).toEqual(false);
    });
  });

  describe("export", () => {
    test("should export b64", () => {
      const kryptos = KryptosKit.from.b64({ ...TEST_OCT_KEY_B64, ...options });

      expect(kryptos.export("b64")).toMatchSnapshot();
    });

    test("should export der", () => {
      const kryptos = KryptosKit.from.b64({ ...TEST_OCT_KEY_B64, ...options });

      expect(kryptos.export("der")).toMatchSnapshot();
    });

    test("should export jwk", () => {
      const kryptos = KryptosKit.from.b64({ ...TEST_OCT_KEY_B64, ...options });

      expect(kryptos.export("jwk")).toMatchSnapshot();
    });

    test("should export pem", () => {
      const kryptos = KryptosKit.from.b64({ ...TEST_OCT_KEY_B64, ...options });

      expect(kryptos.export("pem")).toMatchSnapshot();
    });
  });

  describe("to", () => {
    test("should return db", () => {
      const kryptos = KryptosKit.from.b64({ ...TEST_OCT_KEY_B64, ...options });

      expect(kryptos.toDB()).toMatchSnapshot();
    });

    test("should return json", () => {
      const kryptos = KryptosKit.from.b64({ ...TEST_OCT_KEY_B64, ...options });

      expect(kryptos.toJSON()).toMatchSnapshot();
    });

    // An oct key's material IS `k` — the secret. It has no public half to publish,
    // so `toJWK("public")` is refused rather than answered: the only two things it
    // could return are a JWK that leaks the secret, or one that omits `k` and is
    // malformed per RFC 7517 §6.4.1 (it used to emit the latter, silently). The
    // default mode IS "public", so a bare `toJWK()` is refused too. Asserted as an
    // error class + code, not a snapshot — a snapshot of the message would only
    // re-encode the wording, not the contract.
    test("should have no public JWK", () => {
      const kryptos = KryptosKit.from.b64({ ...TEST_OCT_KEY_B64, ...options });

      expect(() => kryptos.toJWK("public")).toThrow(
        expect.objectContaining({
          name: "KryptosError",
          code: "no_public_jwk",
        }),
      );
      expect(() => kryptos.toJWK()).toThrow(KryptosError);
    });

    test("should return jwk with private key", () => {
      const kryptos = KryptosKit.from.b64({ ...TEST_OCT_KEY_B64, ...options });

      // The private JWK is the only JWK an oct key has, and `k` belongs in it.
      expect(kryptos.toJWK("private").k).toBeTypeOf("string");
      expect(kryptos.toJWK("private")).toMatchSnapshot();
    });

    test("should return kryptos string", () => {
      const kryptos = KryptosKit.from.b64({ ...TEST_OCT_KEY_B64, ...options });

      expect(kryptos.toString()).toMatchSnapshot();
    });
  });
});
