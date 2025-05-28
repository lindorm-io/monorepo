import MockDate from "mockdate";
import { TEST_RSA_KEY_B64 } from "../__fixtures__/rsa-keys";
import { KryptosKit } from "./KryptosKit";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate.toISOString());

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  randomUUID: jest.fn().mockReturnValue("6e6f84b0-e125-5e3f-90ae-c65269668d98"),
}));

describe("Kryptos (RSA)", () => {
  let options: any;

  beforeEach(() => {
    options = {
      id: "3b9a051f-e1ec-562b-bf92-7cf92ec465ba",
      createdAt: new Date("2023-01-01T08:00:00.000Z"),
      expiresAt: new Date("2099-01-01T08:00:00.000Z"),
      isExternal: false,
      issuer: "https://example.com",
      jwksUri: "https://example.com/.well-known/jwks.json",
      notBefore: new Date("2023-01-01T08:00:00.000Z"),
      operations: ["sign", "verify"],
      ownerId: "f02c2d0c-44ee-5e4e-8b3b-39d46924d227",
      purpose: "test",
      updatedAt: new Date("2023-12-01T08:00:00.000Z"),
    };
  });

  describe("metadata", () => {
    test("should return attribute values", () => {
      const kryptos = KryptosKit.from.b64({ ...TEST_RSA_KEY_B64, ...options });

      expect(kryptos.id).toEqual("3b9a051f-e1ec-562b-bf92-7cf92ec465ba");
      expect(kryptos.algorithm).toEqual("RS512");
      expect(kryptos.createdAt).toEqual(new Date("2023-01-01T08:00:00.000Z"));
      expect(kryptos.curve).toEqual(null);
      expect(kryptos.expiresAt).toEqual(new Date("2099-01-01T08:00:00.000Z"));
      expect(kryptos.expiresIn).toEqual(2366841600);
      expect(kryptos.isActive).toEqual(true);
      expect(kryptos.isExpired).toEqual(false);
      expect(kryptos.isExternal).toEqual(false);
      expect(kryptos.issuer).toEqual("https://example.com");
      expect(kryptos.jwksUri).toEqual("https://example.com/.well-known/jwks.json");
      expect(kryptos.modulus).toEqual(4096);
      expect(kryptos.notBefore).toEqual(new Date("2023-01-01T08:00:00.000Z"));
      expect(kryptos.operations).toEqual(["sign", "verify"]);
      expect(kryptos.ownerId).toEqual("f02c2d0c-44ee-5e4e-8b3b-39d46924d227");
      expect(kryptos.purpose).toEqual("test");
      expect(kryptos.type).toEqual("RSA");
      expect(kryptos.updatedAt).toEqual(new Date("2023-12-01T08:00:00.000Z"));
      expect(kryptos.use).toEqual("sig");

      expect(kryptos.hasPrivateKey).toEqual(true);
      expect(kryptos.hasPublicKey).toEqual(true);
    });

    test("should allow setting expiry", () => {
      const kryptos = KryptosKit.from.b64({ ...TEST_RSA_KEY_B64, ...options });

      kryptos.expiresAt = new Date("2023-12-31T08:00:00.000Z");

      expect(kryptos.expiresAt).toEqual(new Date("2023-12-31T08:00:00.000Z"));
      expect(kryptos.updatedAt).toEqual(new Date("2024-01-01T08:00:00.000Z"));

      expect(kryptos.isActive).toEqual(false);
      expect(kryptos.isExpired).toEqual(true);
      expect(kryptos.expiresIn).toEqual(0);
    });
  });

  describe("export", () => {
    test("should export b64", () => {
      const kryptos = KryptosKit.from.b64({ ...TEST_RSA_KEY_B64, ...options });

      expect(kryptos.export("b64")).toMatchSnapshot();
    });

    test("should export der", () => {
      const kryptos = KryptosKit.from.b64({ ...TEST_RSA_KEY_B64, ...options });

      expect(kryptos.export("der")).toMatchSnapshot();
    });

    test("should export jwk", () => {
      const kryptos = KryptosKit.from.b64({ ...TEST_RSA_KEY_B64, ...options });

      expect(kryptos.export("jwk")).toMatchSnapshot();
    });

    test("should export pem", () => {
      const kryptos = KryptosKit.from.b64({ ...TEST_RSA_KEY_B64, ...options });

      expect(kryptos.export("pem")).toMatchSnapshot();
    });
  });

  describe("to", () => {
    test("should return db", () => {
      const kryptos = KryptosKit.from.b64({ ...TEST_RSA_KEY_B64, ...options });

      expect(kryptos.toDB()).toMatchSnapshot();
    });

    test("should return json", () => {
      const kryptos = KryptosKit.from.b64({ ...TEST_RSA_KEY_B64, ...options });

      expect(kryptos.toJSON()).toMatchSnapshot();
    });

    test("should return jwk with public key", () => {
      const kryptos = KryptosKit.from.b64({ ...TEST_RSA_KEY_B64, ...options });

      expect(kryptos.toJWK()).toMatchSnapshot();
    });

    test("should return jwk with private key", () => {
      const kryptos = KryptosKit.from.b64({ ...TEST_RSA_KEY_B64, ...options });

      expect(kryptos.toJWK("private")).toMatchSnapshot();
    });

    test("should return kryptos string", () => {
      const kryptos = KryptosKit.from.b64({ ...TEST_RSA_KEY_B64, ...options });

      expect(kryptos.toString()).toMatchSnapshot();
    });
  });
});
