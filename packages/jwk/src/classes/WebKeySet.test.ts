import MockDate from "mockdate";
import { EcKeySet, OctKeySet, OkpKeySet, RsaKeySet } from ".";
import { WebKeySet } from "./WebKeySet";

MockDate.set("2023-01-01T08:00:00.000Z");

describe("WebKeySet", () => {
  describe("generate", () => {
    test("should generate EC", async () => {
      const webKeySet = await WebKeySet.generate({
        algorithm: "ES512",
        expiresAt: new Date("2024-01-01T00:00:00.000Z"),
        notBefore: new Date(),
        operations: ["sign"],
        ownerId: "58547409-956b-56a4-9ed0-e47f0bf29025",
        type: "EC",
        use: "sig",

        curve: "P-521",
      });

      expect(webKeySet).toBeInstanceOf(WebKeySet);

      const keySet = webKeySet.keySet<EcKeySet>();

      expect(keySet).toBeInstanceOf(EcKeySet);
      expect(keySet.curve).toBe("P-521");
      expect(keySet.type).toBe("EC");

      expect(webKeySet.export("der")).toStrictEqual({
        curve: "P-521",
        privateKey: expect.any(Buffer),
        publicKey: expect.any(Buffer),
        type: "EC",
      });

      expect(webKeySet.export("jwk")).toStrictEqual({
        crv: "P-521",
        d: expect.any(String),
        x: expect.any(String),
        y: expect.any(String),
        kty: "EC",
      });

      expect(webKeySet.export("pem")).toStrictEqual({
        curve: "P-521",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "EC",
      });

      expect(webKeySet.algorithm).toBe("ES512");
      expect(webKeySet.createdAt).toStrictEqual(new Date("2023-01-01T08:00:00.000Z"));
      expect(webKeySet.expiresAt).toStrictEqual(new Date("2024-01-01T00:00:00.000Z"));
      expect(webKeySet.isExternal).toBe(false);
      expect(webKeySet.jwkUri).toBe(undefined);
      expect(webKeySet.keyId).toStrictEqual(expect.any(String));
      expect(webKeySet.notBefore).toStrictEqual(new Date("2023-01-01T08:00:00.000Z"));
      expect(webKeySet.operations).toStrictEqual(["sign"]);
      expect(webKeySet.ownerId).toBe("58547409-956b-56a4-9ed0-e47f0bf29025");
      expect(webKeySet.type).toBe("EC");
      expect(webKeySet.use).toBe("sig");
    });

    test("should generate OKP", async () => {
      const webKeySet = await WebKeySet.generate({
        algorithm: "EdDSA",
        expiresAt: new Date("2024-01-01T00:00:00.000Z"),
        notBefore: new Date(),
        operations: ["sign"],
        ownerId: "58547409-956b-56a4-9ed0-e47f0bf29025",
        type: "OKP",
        use: "sig",

        curve: "Ed25519",
      });

      expect(webKeySet).toBeInstanceOf(WebKeySet);

      const keySet = webKeySet.keySet<OkpKeySet>();

      expect(keySet).toBeInstanceOf(OkpKeySet);
      expect(keySet.curve).toBe("Ed25519");
      expect(keySet.type).toBe("OKP");

      expect(webKeySet.export("der")).toStrictEqual({
        curve: "Ed25519",
        privateKey: expect.any(Buffer),
        publicKey: expect.any(Buffer),
        type: "OKP",
      });

      expect(webKeySet.export("jwk")).toStrictEqual({
        crv: "Ed25519",
        d: expect.any(String),
        x: expect.any(String),
        kty: "OKP",
      });

      expect(webKeySet.export("pem")).toStrictEqual({
        curve: "Ed25519",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "OKP",
      });

      expect(webKeySet.algorithm).toBe("EdDSA");
      expect(webKeySet.createdAt).toStrictEqual(new Date("2023-01-01T08:00:00.000Z"));
      expect(webKeySet.expiresAt).toStrictEqual(new Date("2024-01-01T00:00:00.000Z"));
      expect(webKeySet.isExternal).toBe(false);
      expect(webKeySet.jwkUri).toBe(undefined);
      expect(webKeySet.keyId).toStrictEqual(expect.any(String));
      expect(webKeySet.notBefore).toStrictEqual(new Date("2023-01-01T08:00:00.000Z"));
      expect(webKeySet.operations).toStrictEqual(["sign"]);
      expect(webKeySet.ownerId).toBe("58547409-956b-56a4-9ed0-e47f0bf29025");
      expect(webKeySet.type).toBe("OKP");
      expect(webKeySet.use).toBe("sig");
    });

    test("should generate RSA", async () => {
      const webKeySet = await WebKeySet.generate({
        algorithm: "RS512",
        expiresAt: new Date("2024-01-01T00:00:00.000Z"),
        notBefore: new Date(),
        operations: ["sign"],
        ownerId: "58547409-956b-56a4-9ed0-e47f0bf29025",
        type: "RSA",
        use: "sig",

        modulus: 1,
      });

      expect(webKeySet).toBeInstanceOf(WebKeySet);

      const keySet = webKeySet.keySet<RsaKeySet>();

      expect(keySet).toBeInstanceOf(RsaKeySet);
      expect(keySet.modulus).toBe(1024);
      expect(keySet.type).toBe("RSA");

      expect(webKeySet.export("der")).toStrictEqual({
        privateKey: expect.any(Buffer),
        publicKey: expect.any(Buffer),
        type: "RSA",
      });

      expect(webKeySet.export("jwk")).toStrictEqual({
        d: expect.any(String),
        dp: expect.any(String),
        dq: expect.any(String),
        e: expect.any(String),
        n: expect.any(String),
        p: expect.any(String),
        q: expect.any(String),
        qi: expect.any(String),
        kty: "RSA",
      });

      expect(webKeySet.export("pem")).toStrictEqual({
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "RSA",
      });

      expect(webKeySet.algorithm).toBe("RS512");
      expect(webKeySet.createdAt).toStrictEqual(new Date("2023-01-01T08:00:00.000Z"));
      expect(webKeySet.expiresAt).toStrictEqual(new Date("2024-01-01T00:00:00.000Z"));
      expect(webKeySet.isExternal).toBe(false);
      expect(webKeySet.jwkUri).toBe(undefined);
      expect(webKeySet.keyId).toStrictEqual(expect.any(String));
      expect(webKeySet.notBefore).toStrictEqual(new Date("2023-01-01T08:00:00.000Z"));
      expect(webKeySet.operations).toStrictEqual(["sign"]);
      expect(webKeySet.ownerId).toBe("58547409-956b-56a4-9ed0-e47f0bf29025");
      expect(webKeySet.type).toBe("RSA");
      expect(webKeySet.use).toBe("sig");
    });

    test("should generate oct", async () => {
      const webKeySet = await WebKeySet.generate({
        algorithm: "HS512",
        expiresAt: new Date("2024-01-01T00:00:00.000Z"),
        notBefore: new Date(),
        operations: ["sign"],
        ownerId: "58547409-956b-56a4-9ed0-e47f0bf29025",
        type: "oct",
        use: "sig",

        size: 32,
      });

      expect(webKeySet).toBeInstanceOf(WebKeySet);

      const keySet = webKeySet.keySet<OctKeySet>();

      expect(keySet).toBeInstanceOf(OctKeySet);
      expect(keySet.type).toBe("oct");

      expect(webKeySet.export("der")).toStrictEqual({
        privateKey: expect.any(Buffer),
        type: "oct",
      });

      expect(webKeySet.export("jwk")).toStrictEqual({
        k: expect.any(String),
        kty: "oct",
      });

      expect(webKeySet.export("pem")).toStrictEqual({
        privateKey: expect.any(String),
        type: "oct",
      });

      expect(webKeySet.algorithm).toBe("HS512");
      expect(webKeySet.createdAt).toStrictEqual(new Date("2023-01-01T08:00:00.000Z"));
      expect(webKeySet.expiresAt).toStrictEqual(new Date("2024-01-01T00:00:00.000Z"));
      expect(webKeySet.isExternal).toBe(false);
      expect(webKeySet.jwkUri).toBe(undefined);
      expect(webKeySet.keyId).toStrictEqual(expect.any(String));
      expect(webKeySet.notBefore).toStrictEqual(new Date("2023-01-01T08:00:00.000Z"));
      expect(webKeySet.operations).toStrictEqual(["sign"]);
      expect(webKeySet.ownerId).toBe("58547409-956b-56a4-9ed0-e47f0bf29025");
      expect(webKeySet.type).toBe("oct");
      expect(webKeySet.use).toBe("sig");
    });
  });

  describe("from jwk", () => {
    test("should create EC from jwk", () => {
      const webKeySet = WebKeySet.fromJwk({
        alg: "ES512",
        key_ops: [],
        kid: "4f2099ca-bd6f-52db-8941-e2f134587e0a",
        kty: "EC",
        use: "sig",

        crv: "P-521",
        x: "AXLDVJ0QoP1LPZeiN-OoI9WiKWrlhJmMsGZm1cbbHrJ1FRbdD8gvuR8S0rJwnjbP1SE_hp16_KY0FDgnTb9jH-Oz",
        y: "AZwox6nbyvzbmRQTrgtuxRzxvj-mAocRfZtH2fVXDm4lFYS08pUFd5X12TQPUj_X-INglGRzc7BnX4xhY3fWLmu2",
      });

      expect(webKeySet).toBeInstanceOf(WebKeySet);
      expect(webKeySet.isExternal).toBe(true);

      const keySet = webKeySet.keySet<EcKeySet>();

      expect(keySet).toBeInstanceOf(EcKeySet);
      expect(keySet.curve).toBe("P-521");
      expect(keySet.type).toBe("EC");

      expect(webKeySet.export("jwk")).toStrictEqual({
        crv: "P-521",
        x: "AXLDVJ0QoP1LPZeiN-OoI9WiKWrlhJmMsGZm1cbbHrJ1FRbdD8gvuR8S0rJwnjbP1SE_hp16_KY0FDgnTb9jH-Oz",
        y: "AZwox6nbyvzbmRQTrgtuxRzxvj-mAocRfZtH2fVXDm4lFYS08pUFd5X12TQPUj_X-INglGRzc7BnX4xhY3fWLmu2",
        kty: "EC",
      });

      expect(webKeySet.export("pem")).toStrictEqual({
        curve: "P-521",
        publicKey:
          "-----BEGIN PUBLIC KEY-----\n" +
          "MIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQBcsNUnRCg/Us9l6I346gj1aIpauWE\n" +
          "mYywZmbVxtsesnUVFt0PyC+5HxLSsnCeNs/VIT+GnXr8pjQUOCdNv2Mf47MBnCjH\n" +
          "qdvK/NuZFBOuC27FHPG+P6YChxF9m0fZ9VcObiUVhLTylQV3lfXZNA9SP9f4g2CU\n" +
          "ZHNzsGdfjGFjd9Yua7Y=\n" +
          "-----END PUBLIC KEY-----\n",
        type: "EC",
      });
    });

    test("should create OKP from jwk", () => {
      const webKeySet = WebKeySet.fromJwk({
        alg: "EdDSA",
        key_ops: [],
        kid: "a686e83a-295e-563f-b5b2-4d8eec65a654",
        kty: "OKP",
        use: "sig",

        crv: "Ed25519",
        x: "couqlejAGmC2THWSej7E2sREswvyl0_kudseDi1L-sE",
      });

      expect(webKeySet).toBeInstanceOf(WebKeySet);
      expect(webKeySet.isExternal).toBe(true);

      const keySet = webKeySet.keySet<OkpKeySet>();

      expect(keySet).toBeInstanceOf(OkpKeySet);
      expect(keySet.curve).toBe("Ed25519");
      expect(keySet.type).toBe("OKP");

      expect(webKeySet.export("jwk")).toStrictEqual({
        crv: "Ed25519",
        x: "couqlejAGmC2THWSej7E2sREswvyl0_kudseDi1L-sE",
        kty: "OKP",
      });

      expect(webKeySet.export("pem")).toStrictEqual({
        curve: "Ed25519",
        publicKey:
          "-----BEGIN PUBLIC KEY-----\n" +
          "MCowBQYDK2VwAyEAcouqlejAGmC2THWSej7E2sREswvyl0/kudseDi1L+sE=\n" +
          "-----END PUBLIC KEY-----\n",
        type: "OKP",
      });
    });

    test("should create RSA from jwk", () => {
      const webKeySet = WebKeySet.fromJwk({
        alg: "RS512",
        key_ops: [],
        kid: "9665bd2f-5231-5803-a351-184aadb31797",
        kty: "RSA",
        use: "sig",

        e: "AQAB",
        n: "0SzZpjJnjtQF9YKbvKdtwPxa4I-SAOpfBXFCWSzNWfzS8hhCIO17-w2MPXSjh-7-dYWjO6h322k74x5YMOPF5zSzUEZDgESh5RpKrRvmdbF4PngvMoIL8QH6phoHzSqhFBRDQ99Z6h8lPk2RZLiJ5FoudsB2qDN3sbu0O1cyuXM",
      });

      expect(webKeySet).toBeInstanceOf(WebKeySet);
      expect(webKeySet.isExternal).toBe(true);

      const keySet = webKeySet.keySet<RsaKeySet>();

      expect(keySet).toBeInstanceOf(RsaKeySet);
      expect(keySet.modulus).toBe(1024);
      expect(keySet.type).toBe("RSA");

      expect(webKeySet.export("jwk")).toStrictEqual({
        e: "AQAB",
        n: "0SzZpjJnjtQF9YKbvKdtwPxa4I-SAOpfBXFCWSzNWfzS8hhCIO17-w2MPXSjh-7-dYWjO6h322k74x5YMOPF5zSzUEZDgESh5RpKrRvmdbF4PngvMoIL8QH6phoHzSqhFBRDQ99Z6h8lPk2RZLiJ5FoudsB2qDN3sbu0O1cyuXM",
        kty: "RSA",
      });

      expect(webKeySet.export("pem")).toStrictEqual({
        publicKey:
          "-----BEGIN RSA PUBLIC KEY-----\n" +
          "MIGJAoGBANEs2aYyZ47UBfWCm7ynbcD8WuCPkgDqXwVxQlkszVn80vIYQiDte/sN\n" +
          "jD10o4fu/nWFozuod9tpO+MeWDDjxec0s1BGQ4BEoeUaSq0b5nWxeD54LzKCC/EB\n" +
          "+qYaB80qoRQUQ0PfWeofJT5NkWS4ieRaLnbAdqgzd7G7tDtXMrlzAgMBAAE=\n" +
          "-----END RSA PUBLIC KEY-----\n",
        type: "RSA",
      });
    });

    test("should create oct from jwk", () => {
      const webKeySet = WebKeySet.fromJwk({
        alg: "HS512",
        key_ops: [],
        kid: "e6a3f1e5-4f8f-5f2c-9f7f-9e8e7a1d0f8d",
        kty: "oct",
        use: "sig",

        k: "UUZtKSFfTTZXaWx0WVNGd3FsWjVzRFRvcWVaTWZ4KjA",
      });

      expect(webKeySet).toBeInstanceOf(WebKeySet);
      expect(webKeySet.isExternal).toBe(true);

      const keySet = webKeySet.keySet<OctKeySet>();

      expect(keySet).toBeInstanceOf(OctKeySet);
      expect(keySet.type).toBe("oct");

      expect(webKeySet.export("jwk")).toStrictEqual({
        k: "UUZtKSFfTTZXaWx0WVNGd3FsWjVzRFRvcWVaTWZ4KjA",
        kty: "oct",
      });

      expect(webKeySet.export("pem")).toStrictEqual({
        privateKey: "QFm)!_M6WiltYSFwqlZ5sDToqeZMfx*0",
        type: "oct",
      });
    });
  });
});
