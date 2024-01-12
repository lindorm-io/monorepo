import MockDate from "mockdate";
import { EcKeySet, OctKeySet, OkpKeySet, RsaKeySet } from ".";
import { WebKeySet } from "./WebKeySet";

MockDate.set("2023-01-01T08:00:00.000Z");

describe("WebKeySet", () => {
  describe("generate", () => {
    test("should generate EC", async () => {
      const webKeySet = await WebKeySet.generate({
        id: "02aa9f69-ea48-568b-bf80-496041a792d8",
        algorithm: "ES512",
        expiresAt: new Date("2024-01-01T00:00:00.000Z"),
        jwkUri: "https://example.com/jwks.json",
        notBefore: new Date(),
        operations: ["sign"],
        ownerId: "58547409-956b-56a4-9ed0-e47f0bf29025",
        type: "EC",
        use: "sig",

        curve: "P-521",
      });

      expect(webKeySet).toBeInstanceOf(WebKeySet);

      const keySet = webKeySet.keySet as EcKeySet;

      expect(keySet).toBeInstanceOf(EcKeySet);
      expect(keySet.curve).toBe("P-521");
      expect(keySet.type).toBe("EC");

      expect(webKeySet.export("der")).toStrictEqual({
        id: "02aa9f69-ea48-568b-bf80-496041a792d8",
        curve: "P-521",
        privateKey: expect.any(Buffer),
        publicKey: expect.any(Buffer),
        type: "EC",
      });

      expect(webKeySet.export("jwk")).toStrictEqual({
        crv: "P-521",
        d: expect.any(String),
        kid: "02aa9f69-ea48-568b-bf80-496041a792d8",
        kty: "EC",
        x: expect.any(String),
        y: expect.any(String),
      });

      expect(webKeySet.export("pem")).toStrictEqual({
        id: "02aa9f69-ea48-568b-bf80-496041a792d8",
        curve: "P-521",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "EC",
      });

      expect(webKeySet.id).toBe("02aa9f69-ea48-568b-bf80-496041a792d8");
      expect(webKeySet.algorithm).toBe("ES512");
      expect(webKeySet.createdAt).toStrictEqual(new Date("2023-01-01T08:00:00.000Z"));
      expect(webKeySet.curve).toBe("P-521");
      expect(webKeySet.expiresAt).toStrictEqual(new Date("2024-01-01T00:00:00.000Z"));
      expect(webKeySet.expiresIn).toBe(31507200);
      expect(webKeySet.isExternal).toBe(false);
      expect(webKeySet.jwkUri).toBe("https://example.com/jwks.json");
      expect(webKeySet.notBefore).toStrictEqual(new Date("2023-01-01T08:00:00.000Z"));
      expect(webKeySet.operations).toStrictEqual(["sign"]);
      expect(webKeySet.ownerId).toBe("58547409-956b-56a4-9ed0-e47f0bf29025");
      expect(webKeySet.type).toBe("EC");
      expect(webKeySet.updatedAt).toStrictEqual(new Date("2023-01-01T08:00:00.000Z"));
      expect(webKeySet.use).toBe("sig");

      expect(webKeySet.jwk("both")).toStrictEqual({
        alg: "ES512",
        crv: "P-521",
        d: expect.any(String),
        exp: 1704067200,
        expires_in: 31507200,
        iat: 1672560000,
        jku: "https://example.com/jwks.json",
        key_ops: ["sign"],
        kid: "02aa9f69-ea48-568b-bf80-496041a792d8",
        kty: "EC",
        nbf: 1672560000,
        owner_id: "58547409-956b-56a4-9ed0-e47f0bf29025",
        uat: 1672560000,
        use: "sig",
        x: expect.any(String),
        y: expect.any(String),
      });

      expect(webKeySet.metadata).toStrictEqual({
        id: "02aa9f69-ea48-568b-bf80-496041a792d8",
        algorithm: "ES512",
        createdAt: new Date("2023-01-01T08:00:00.000Z"),
        curve: "P-521",
        expiresAt: new Date("2024-01-01T00:00:00.000Z"),
        expiresIn: 31507200,
        isExternal: false,
        jwkUri: "https://example.com/jwks.json",
        notBefore: new Date("2023-01-01T08:00:00.000Z"),
        operations: ["sign"],
        ownerId: "58547409-956b-56a4-9ed0-e47f0bf29025",
        type: "EC",
        updatedAt: new Date("2023-01-01T08:00:00.000Z"),
        use: "sig",
      });
    });

    test("should generate oct", async () => {
      const webKeySet = await WebKeySet.generate({
        id: "02aa9f69-ea48-568b-bf80-496041a792d8",
        algorithm: "HS512",
        expiresAt: new Date("2024-01-01T00:00:00.000Z"),
        jwkUri: "https://example.com/jwks.json",
        notBefore: new Date(),
        operations: ["sign"],
        ownerId: "58547409-956b-56a4-9ed0-e47f0bf29025",
        size: 32,
        type: "oct",
        use: "sig",
      });

      expect(webKeySet).toBeInstanceOf(WebKeySet);

      const keySet = webKeySet.keySet as OctKeySet;

      expect(keySet).toBeInstanceOf(OctKeySet);
      expect(keySet.type).toBe("oct");

      expect(webKeySet.export("der")).toStrictEqual({
        id: "02aa9f69-ea48-568b-bf80-496041a792d8",
        privateKey: expect.any(Buffer),
        type: "oct",
      });

      expect(webKeySet.export("jwk")).toStrictEqual({
        k: expect.any(String),
        kid: "02aa9f69-ea48-568b-bf80-496041a792d8",
        kty: "oct",
      });

      expect(webKeySet.export("pem")).toStrictEqual({
        id: "02aa9f69-ea48-568b-bf80-496041a792d8",
        privateKey: expect.any(String),
        type: "oct",
      });

      expect(webKeySet.id).toBe("02aa9f69-ea48-568b-bf80-496041a792d8");
      expect(webKeySet.algorithm).toBe("HS512");
      expect(webKeySet.createdAt).toStrictEqual(new Date("2023-01-01T08:00:00.000Z"));
      expect(webKeySet.expiresAt).toStrictEqual(new Date("2024-01-01T00:00:00.000Z"));
      expect(webKeySet.expiresIn).toBe(31507200);
      expect(webKeySet.isExternal).toBe(false);
      expect(webKeySet.jwkUri).toBe("https://example.com/jwks.json");
      expect(webKeySet.notBefore).toStrictEqual(new Date("2023-01-01T08:00:00.000Z"));
      expect(webKeySet.operations).toStrictEqual(["sign"]);
      expect(webKeySet.ownerId).toBe("58547409-956b-56a4-9ed0-e47f0bf29025");
      expect(webKeySet.type).toBe("oct");
      expect(webKeySet.updatedAt).toStrictEqual(new Date("2023-01-01T08:00:00.000Z"));
      expect(webKeySet.use).toBe("sig");

      expect(webKeySet.jwk("both")).toStrictEqual({
        alg: "HS512",
        exp: 1704067200,
        expires_in: 31507200,
        iat: 1672560000,
        jku: "https://example.com/jwks.json",
        k: expect.any(String),
        key_ops: ["sign"],
        kid: "02aa9f69-ea48-568b-bf80-496041a792d8",
        kty: "oct",
        nbf: 1672560000,
        owner_id: "58547409-956b-56a4-9ed0-e47f0bf29025",
        uat: 1672560000,
        use: "sig",
      });

      expect(webKeySet.metadata).toStrictEqual({
        id: "02aa9f69-ea48-568b-bf80-496041a792d8",
        algorithm: "HS512",
        createdAt: new Date("2023-01-01T08:00:00.000Z"),
        curve: undefined,
        expiresAt: new Date("2024-01-01T00:00:00.000Z"),
        expiresIn: 31507200,
        isExternal: false,
        jwkUri: "https://example.com/jwks.json",
        notBefore: new Date("2023-01-01T08:00:00.000Z"),
        operations: ["sign"],
        ownerId: "58547409-956b-56a4-9ed0-e47f0bf29025",
        type: "oct",
        updatedAt: new Date("2023-01-01T08:00:00.000Z"),
        use: "sig",
      });
    });

    test("should generate OKP", async () => {
      const webKeySet = await WebKeySet.generate({
        id: "02aa9f69-ea48-568b-bf80-496041a792d8",
        algorithm: "EdDSA",
        curve: "Ed25519",
        expiresAt: new Date("2024-01-01T00:00:00.000Z"),
        jwkUri: "https://example.com/jwks.json",
        notBefore: new Date(),
        operations: ["sign"],
        ownerId: "58547409-956b-56a4-9ed0-e47f0bf29025",
        type: "OKP",
        use: "sig",
      });

      expect(webKeySet).toBeInstanceOf(WebKeySet);

      const keySet = webKeySet.keySet as OkpKeySet;

      expect(keySet).toBeInstanceOf(OkpKeySet);
      expect(keySet.curve).toBe("Ed25519");
      expect(keySet.type).toBe("OKP");

      expect(webKeySet.export("der")).toStrictEqual({
        id: "02aa9f69-ea48-568b-bf80-496041a792d8",
        curve: "Ed25519",
        privateKey: expect.any(Buffer),
        publicKey: expect.any(Buffer),
        type: "OKP",
      });

      expect(webKeySet.export("jwk")).toStrictEqual({
        crv: "Ed25519",
        d: expect.any(String),
        kid: "02aa9f69-ea48-568b-bf80-496041a792d8",
        kty: "OKP",
        x: expect.any(String),
      });

      expect(webKeySet.export("pem")).toStrictEqual({
        id: "02aa9f69-ea48-568b-bf80-496041a792d8",
        curve: "Ed25519",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "OKP",
      });

      expect(webKeySet.id).toBe("02aa9f69-ea48-568b-bf80-496041a792d8");
      expect(webKeySet.algorithm).toBe("EdDSA");
      expect(webKeySet.createdAt).toStrictEqual(new Date("2023-01-01T08:00:00.000Z"));
      expect(webKeySet.curve).toBe("Ed25519");
      expect(webKeySet.expiresAt).toStrictEqual(new Date("2024-01-01T00:00:00.000Z"));
      expect(webKeySet.expiresIn).toBe(31507200);
      expect(webKeySet.isExternal).toBe(false);
      expect(webKeySet.jwkUri).toBe("https://example.com/jwks.json");
      expect(webKeySet.notBefore).toStrictEqual(new Date("2023-01-01T08:00:00.000Z"));
      expect(webKeySet.operations).toStrictEqual(["sign"]);
      expect(webKeySet.ownerId).toBe("58547409-956b-56a4-9ed0-e47f0bf29025");
      expect(webKeySet.type).toBe("OKP");
      expect(webKeySet.updatedAt).toStrictEqual(new Date("2023-01-01T08:00:00.000Z"));
      expect(webKeySet.use).toBe("sig");

      expect(webKeySet.jwk("both")).toStrictEqual({
        alg: "EdDSA",
        crv: "Ed25519",
        d: expect.any(String),
        exp: 1704067200,
        expires_in: 31507200,
        iat: 1672560000,
        jku: "https://example.com/jwks.json",
        key_ops: ["sign"],
        kid: "02aa9f69-ea48-568b-bf80-496041a792d8",
        kty: "OKP",
        nbf: 1672560000,
        owner_id: "58547409-956b-56a4-9ed0-e47f0bf29025",
        uat: 1672560000,
        use: "sig",
        x: expect.any(String),
      });

      expect(webKeySet.metadata).toStrictEqual({
        id: "02aa9f69-ea48-568b-bf80-496041a792d8",
        algorithm: "EdDSA",
        createdAt: new Date("2023-01-01T08:00:00.000Z"),
        curve: "Ed25519",
        expiresAt: new Date("2024-01-01T00:00:00.000Z"),
        expiresIn: 31507200,
        isExternal: false,
        jwkUri: "https://example.com/jwks.json",
        notBefore: new Date("2023-01-01T08:00:00.000Z"),
        operations: ["sign"],
        ownerId: "58547409-956b-56a4-9ed0-e47f0bf29025",
        type: "OKP",
        updatedAt: new Date("2023-01-01T08:00:00.000Z"),
        use: "sig",
      });
    });

    test("should generate RSA", async () => {
      const webKeySet = await WebKeySet.generate({
        id: "02aa9f69-ea48-568b-bf80-496041a792d8",
        algorithm: "RS512",
        expiresAt: new Date("2024-01-01T00:00:00.000Z"),
        jwkUri: "https://example.com/jwks.json",
        modulus: 1,
        notBefore: new Date(),
        operations: ["sign"],
        ownerId: "58547409-956b-56a4-9ed0-e47f0bf29025",
        type: "RSA",
        use: "sig",
      });

      expect(webKeySet).toBeInstanceOf(WebKeySet);

      const keySet = webKeySet.keySet as RsaKeySet;

      expect(keySet).toBeInstanceOf(RsaKeySet);
      expect(keySet.modulus).toBe(1024);
      expect(keySet.type).toBe("RSA");

      expect(webKeySet.export("der")).toStrictEqual({
        id: "02aa9f69-ea48-568b-bf80-496041a792d8",
        privateKey: expect.any(Buffer),
        publicKey: expect.any(Buffer),
        type: "RSA",
      });

      expect(webKeySet.export("jwk")).toStrictEqual({
        d: expect.any(String),
        dp: expect.any(String),
        dq: expect.any(String),
        e: expect.any(String),
        kid: "02aa9f69-ea48-568b-bf80-496041a792d8",
        kty: "RSA",
        n: expect.any(String),
        p: expect.any(String),
        q: expect.any(String),
        qi: expect.any(String),
      });

      expect(webKeySet.export("pem")).toStrictEqual({
        id: "02aa9f69-ea48-568b-bf80-496041a792d8",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "RSA",
      });

      expect(webKeySet.id).toBe("02aa9f69-ea48-568b-bf80-496041a792d8");
      expect(webKeySet.algorithm).toBe("RS512");
      expect(webKeySet.createdAt).toStrictEqual(new Date("2023-01-01T08:00:00.000Z"));
      expect(webKeySet.curve).toBe(undefined);
      expect(webKeySet.expiresAt).toStrictEqual(new Date("2024-01-01T00:00:00.000Z"));
      expect(webKeySet.expiresIn).toBe(31507200);
      expect(webKeySet.isExternal).toBe(false);
      expect(webKeySet.jwkUri).toBe("https://example.com/jwks.json");
      expect(webKeySet.notBefore).toStrictEqual(new Date("2023-01-01T08:00:00.000Z"));
      expect(webKeySet.operations).toStrictEqual(["sign"]);
      expect(webKeySet.ownerId).toBe("58547409-956b-56a4-9ed0-e47f0bf29025");
      expect(webKeySet.type).toBe("RSA");
      expect(webKeySet.updatedAt).toStrictEqual(new Date("2023-01-01T08:00:00.000Z"));
      expect(webKeySet.use).toBe("sig");

      expect(webKeySet.jwk("both")).toStrictEqual({
        alg: "RS512",
        d: expect.any(String),
        dp: expect.any(String),
        dq: expect.any(String),
        e: "AQAB",
        exp: 1704067200,
        expires_in: 31507200,
        iat: 1672560000,
        jku: "https://example.com/jwks.json",
        key_ops: ["sign"],
        kid: "02aa9f69-ea48-568b-bf80-496041a792d8",
        kty: "RSA",
        n: expect.any(String),
        nbf: 1672560000,
        owner_id: "58547409-956b-56a4-9ed0-e47f0bf29025",
        p: expect.any(String),
        q: expect.any(String),
        qi: expect.any(String),
        uat: 1672560000,
        use: "sig",
      });

      expect(webKeySet.metadata).toStrictEqual({
        id: "02aa9f69-ea48-568b-bf80-496041a792d8",
        algorithm: "RS512",
        createdAt: new Date("2023-01-01T08:00:00.000Z"),
        curve: undefined,
        expiresAt: new Date("2024-01-01T00:00:00.000Z"),
        expiresIn: 31507200,
        isExternal: false,
        jwkUri: "https://example.com/jwks.json",
        notBefore: new Date("2023-01-01T08:00:00.000Z"),
        operations: ["sign"],
        ownerId: "58547409-956b-56a4-9ed0-e47f0bf29025",
        type: "RSA",
        updatedAt: new Date("2023-01-01T08:00:00.000Z"),
        use: "sig",
      });
    });
  });

  describe("from jwk", () => {
    test("should create EC from jwk", () => {
      const webKeySet = WebKeySet.fromJwk({
        alg: "ES512",
        crv: "P-521",
        key_ops: [],
        kid: "4f2099ca-bd6f-52db-8941-e2f134587e0a",
        kty: "EC",
        use: "sig",
        x: "AXLDVJ0QoP1LPZeiN-OoI9WiKWrlhJmMsGZm1cbbHrJ1FRbdD8gvuR8S0rJwnjbP1SE_hp16_KY0FDgnTb9jH-Oz",
        y: "AZwox6nbyvzbmRQTrgtuxRzxvj-mAocRfZtH2fVXDm4lFYS08pUFd5X12TQPUj_X-INglGRzc7BnX4xhY3fWLmu2",
      });

      expect(webKeySet).toBeInstanceOf(WebKeySet);
      expect(webKeySet.isExternal).toBe(true);

      const keySet = webKeySet.keySet as EcKeySet;

      expect(keySet).toBeInstanceOf(EcKeySet);
      expect(keySet.curve).toBe("P-521");
      expect(keySet.type).toBe("EC");

      expect(webKeySet.export("jwk")).toStrictEqual({
        crv: "P-521",
        kid: "4f2099ca-bd6f-52db-8941-e2f134587e0a",
        kty: "EC",
        x: "AXLDVJ0QoP1LPZeiN-OoI9WiKWrlhJmMsGZm1cbbHrJ1FRbdD8gvuR8S0rJwnjbP1SE_hp16_KY0FDgnTb9jH-Oz",
        y: "AZwox6nbyvzbmRQTrgtuxRzxvj-mAocRfZtH2fVXDm4lFYS08pUFd5X12TQPUj_X-INglGRzc7BnX4xhY3fWLmu2",
      });

      expect(webKeySet.export("pem")).toStrictEqual({
        id: "4f2099ca-bd6f-52db-8941-e2f134587e0a",
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

    test("should create oct from jwk", () => {
      const webKeySet = WebKeySet.fromJwk({
        alg: "HS512",
        k: "TnpRa0dATFNjbXB5QExHTWlPS0BNQnhidHVSTkBCRWE",
        key_ops: [],
        kid: "e6a3f1e5-4f8f-5f2c-9f7f-9e8e7a1d0f8d",
        kty: "oct",
        use: "sig",
      });

      expect(webKeySet).toBeInstanceOf(WebKeySet);
      expect(webKeySet.isExternal).toBe(true);

      const keySet = webKeySet.keySet;

      expect(keySet).toBeInstanceOf(OctKeySet);
      expect(keySet.type).toBe("oct");

      expect(webKeySet.export("jwk")).toStrictEqual({
        k: "TnpRa0dATFNjbXB5QExHTWlPS0BNQnhidHVSTkBCRWE",
        kid: "e6a3f1e5-4f8f-5f2c-9f7f-9e8e7a1d0f8d",
        kty: "oct",
      });

      expect(webKeySet.export("pem")).toStrictEqual({
        id: "e6a3f1e5-4f8f-5f2c-9f7f-9e8e7a1d0f8d",
        privateKey: "NzQkG@LScmpy@LGMiOK@MBxbtuRN@BEa",
        type: "oct",
      });
    });

    test("should create OKP from jwk", () => {
      const webKeySet = WebKeySet.fromJwk({
        alg: "EdDSA",
        crv: "Ed25519",
        key_ops: [],
        kid: "a686e83a-295e-563f-b5b2-4d8eec65a654",
        kty: "OKP",
        use: "sig",
        x: "couqlejAGmC2THWSej7E2sREswvyl0_kudseDi1L-sE",
      });

      expect(webKeySet).toBeInstanceOf(WebKeySet);
      expect(webKeySet.isExternal).toBe(true);

      const keySet = webKeySet.keySet as OkpKeySet;

      expect(keySet).toBeInstanceOf(OkpKeySet);
      expect(keySet.curve).toBe("Ed25519");
      expect(keySet.type).toBe("OKP");

      expect(webKeySet.export("jwk")).toStrictEqual({
        crv: "Ed25519",
        kid: "a686e83a-295e-563f-b5b2-4d8eec65a654",
        kty: "OKP",
        x: "couqlejAGmC2THWSej7E2sREswvyl0_kudseDi1L-sE",
      });

      expect(webKeySet.export("pem")).toStrictEqual({
        id: "a686e83a-295e-563f-b5b2-4d8eec65a654",
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
        e: "AQAB",
        key_ops: [],
        kid: "9665bd2f-5231-5803-a351-184aadb31797",
        kty: "RSA",
        n: "0SzZpjJnjtQF9YKbvKdtwPxa4I-SAOpfBXFCWSzNWfzS8hhCIO17-w2MPXSjh-7-dYWjO6h322k74x5YMOPF5zSzUEZDgESh5RpKrRvmdbF4PngvMoIL8QH6phoHzSqhFBRDQ99Z6h8lPk2RZLiJ5FoudsB2qDN3sbu0O1cyuXM",
        use: "sig",
      });

      expect(webKeySet).toBeInstanceOf(WebKeySet);
      expect(webKeySet.isExternal).toBe(true);

      const keySet = webKeySet.keySet as RsaKeySet;

      expect(keySet).toBeInstanceOf(RsaKeySet);
      expect(keySet.modulus).toBe(1024);
      expect(keySet.type).toBe("RSA");

      expect(webKeySet.export("jwk")).toStrictEqual({
        e: "AQAB",
        kid: "9665bd2f-5231-5803-a351-184aadb31797",
        kty: "RSA",
        n: "0SzZpjJnjtQF9YKbvKdtwPxa4I-SAOpfBXFCWSzNWfzS8hhCIO17-w2MPXSjh-7-dYWjO6h322k74x5YMOPF5zSzUEZDgESh5RpKrRvmdbF4PngvMoIL8QH6phoHzSqhFBRDQ99Z6h8lPk2RZLiJ5FoudsB2qDN3sbu0O1cyuXM",
      });

      expect(webKeySet.export("pem")).toStrictEqual({
        id: "9665bd2f-5231-5803-a351-184aadb31797",
        publicKey:
          "-----BEGIN RSA PUBLIC KEY-----\n" +
          "MIGJAoGBANEs2aYyZ47UBfWCm7ynbcD8WuCPkgDqXwVxQlkszVn80vIYQiDte/sN\n" +
          "jD10o4fu/nWFozuod9tpO+MeWDDjxec0s1BGQ4BEoeUaSq0b5nWxeD54LzKCC/EB\n" +
          "+qYaB80qoRQUQ0PfWeofJT5NkWS4ieRaLnbAdqgzd7G7tDtXMrlzAgMBAAE=\n" +
          "-----END RSA PUBLIC KEY-----\n",
        type: "RSA",
      });
    });
  });
});
