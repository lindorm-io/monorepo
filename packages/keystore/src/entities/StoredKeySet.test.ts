import { WebKeySet } from "@lindorm-io/jwk";
import MockDate from "mockdate";
import { KEY_PAIR_SIG_EC } from "../fixtures/stored-key-sets.fixture";
import { createTestStoredKeySetEc } from "../mocks";
import { StoredKeySet } from "./StoredKeySet";

MockDate.set("2020-01-01T08:00:00.000Z");

describe("StoredKeySet", () => {
  let storedKeySet: StoredKeySet;

  beforeEach(() => {
    storedKeySet = createTestStoredKeySetEc();
  });

  test("should resolve data from getters", () => {
    expect(storedKeySet.id).toBe("971c8839-af23-545f-8e2b-2f31d3e3af11");
    expect(storedKeySet.webKeySet.algorithm).toBe("ES512");
    expect(storedKeySet.webKeySet.createdAt).toStrictEqual(new Date("2019-12-24T08:00:00.000Z"));
    expect(storedKeySet.webKeySet.expiresAt).toStrictEqual(new Date("2099-01-01T00:00:00.000Z"));
    expect(storedKeySet.webKeySet.isExternal).toBe(false);
    expect(storedKeySet.webKeySet.jwkUri).toBe("https://example.com/jwks.json");
    expect(storedKeySet.webKeySet.notBefore).toStrictEqual(new Date("2020-01-01T00:00:00.000Z"));
    expect(storedKeySet.webKeySet.operations).toStrictEqual(["sign", "verify"]);
    expect(storedKeySet.webKeySet.ownerId).toBe("2ce9eb4b-1088-577e-a065-c3383e7c821f");
    expect(storedKeySet.webKeySet.updatedAt).toStrictEqual(new Date("2019-12-28T08:00:00.000Z"));
    expect(storedKeySet.webKeySet.use).toBe("sig");

    expect(storedKeySet.webKeySet.metadata).toStrictEqual({
      id: "971c8839-af23-545f-8e2b-2f31d3e3af11",
      algorithm: "ES512",
      createdAt: new Date("2019-12-24T08:00:00.000Z"),
      curve: "P-521",
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      expiresIn: 2493043200,
      isExternal: false,
      jwkUri: "https://example.com/jwks.json",
      notBefore: new Date("2020-01-01T00:00:00.000Z"),
      operations: ["sign", "verify"],
      ownerId: "2ce9eb4b-1088-577e-a065-c3383e7c821f",
      type: "EC",
      updatedAt: new Date("2019-12-28T08:00:00.000Z"),
      use: "sig",
    });
    expect(storedKeySet.webKeySet.hasPrivateKey).toBe(true);
    expect(storedKeySet.webKeySet.hasPublicKey).toBe(true);
  });

  test("should export b64", () => {
    expect(storedKeySet.webKeySet.export("b64", "both")).toStrictEqual({
      id: "971c8839-af23-545f-8e2b-2f31d3e3af11",
      curve: "P-521",
      privateKey:
        "MIHuAgEAMBAGByqGSM49AgEGBSuBBAAjBIHWMIHTAgEBBEIB-1dzKp5FO_wISTaIPHCv1yZLMZl0o6BAXgMKibC6e8iFI9W4YIrZYTInHDpqA_wNd764XikWWse9jRRwKLYy02KhgYkDgYYABAFyw1SdEKD9Sz2XojfjqCPVoilq5YSZjLBmZtXG2x6ydRUW3Q_IL7kfEtKycJ42z9UhP4adevymNBQ4J02_Yx_jswGcKMep28r825kUE64LbsUc8b4_pgKHEX2bR9n1Vw5uJRWEtPKVBXeV9dk0D1I_1_iDYJRkc3OwZ1-MYWN31i5rtg",
      publicKey:
        "MIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQBcsNUnRCg_Us9l6I346gj1aIpauWEmYywZmbVxtsesnUVFt0PyC-5HxLSsnCeNs_VIT-GnXr8pjQUOCdNv2Mf47MBnCjHqdvK_NuZFBOuC27FHPG-P6YChxF9m0fZ9VcObiUVhLTylQV3lfXZNA9SP9f4g2CUZHNzsGdfjGFjd9Yua7Y",
      type: "EC",
    });
  });

  test("should export der", () => {
    expect(storedKeySet.webKeySet.export("der", "both")).toStrictEqual({
      id: "971c8839-af23-545f-8e2b-2f31d3e3af11",
      curve: "P-521",
      privateKey: Buffer.from(
        "MIHuAgEAMBAGByqGSM49AgEGBSuBBAAjBIHWMIHTAgEBBEIB-1dzKp5FO_wISTaIPHCv1yZLMZl0o6BAXgMKibC6e8iFI9W4YIrZYTInHDpqA_wNd764XikWWse9jRRwKLYy02KhgYkDgYYABAFyw1SdEKD9Sz2XojfjqCPVoilq5YSZjLBmZtXG2x6ydRUW3Q_IL7kfEtKycJ42z9UhP4adevymNBQ4J02_Yx_jswGcKMep28r825kUE64LbsUc8b4_pgKHEX2bR9n1Vw5uJRWEtPKVBXeV9dk0D1I_1_iDYJRkc3OwZ1-MYWN31i5rtg",
        "base64url",
      ),
      publicKey: Buffer.from(
        "MIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQBcsNUnRCg_Us9l6I346gj1aIpauWEmYywZmbVxtsesnUVFt0PyC-5HxLSsnCeNs_VIT-GnXr8pjQUOCdNv2Mf47MBnCjHqdvK_NuZFBOuC27FHPG-P6YChxF9m0fZ9VcObiUVhLTylQV3lfXZNA9SP9f4g2CUZHNzsGdfjGFjd9Yua7Y",
        "base64url",
      ),
      type: "EC",
    });
  });

  test("should export jwk", () => {
    expect(storedKeySet.webKeySet.export("jwk", "both")).toStrictEqual({
      crv: "P-521",
      d: "AftXcyqeRTv8CEk2iDxwr9cmSzGZdKOgQF4DComwunvIhSPVuGCK2WEyJxw6agP8DXe-uF4pFlrHvY0UcCi2MtNi",
      kid: "971c8839-af23-545f-8e2b-2f31d3e3af11",
      kty: "EC",
      x: "AXLDVJ0QoP1LPZeiN-OoI9WiKWrlhJmMsGZm1cbbHrJ1FRbdD8gvuR8S0rJwnjbP1SE_hp16_KY0FDgnTb9jH-Oz",
      y: "AZwox6nbyvzbmRQTrgtuxRzxvj-mAocRfZtH2fVXDm4lFYS08pUFd5X12TQPUj_X-INglGRzc7BnX4xhY3fWLmu2",
    });
  });

  test("should export pem", () => {
    expect(storedKeySet.webKeySet.export("pem", "both")).toStrictEqual({
      id: "971c8839-af23-545f-8e2b-2f31d3e3af11",
      curve: "P-521",
      privateKey:
        "-----BEGIN PRIVATE KEY-----\n" +
        "MIHuAgEAMBAGByqGSM49AgEGBSuBBAAjBIHWMIHTAgEBBEIB+1dzKp5FO/wISTaI\n" +
        "PHCv1yZLMZl0o6BAXgMKibC6e8iFI9W4YIrZYTInHDpqA/wNd764XikWWse9jRRw\n" +
        "KLYy02KhgYkDgYYABAFyw1SdEKD9Sz2XojfjqCPVoilq5YSZjLBmZtXG2x6ydRUW\n" +
        "3Q/IL7kfEtKycJ42z9UhP4adevymNBQ4J02/Yx/jswGcKMep28r825kUE64LbsUc\n" +
        "8b4/pgKHEX2bR9n1Vw5uJRWEtPKVBXeV9dk0D1I/1/iDYJRkc3OwZ1+MYWN31i5r\n" +
        "tg==\n" +
        "-----END PRIVATE KEY-----\n",
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

  test("should export jwk", () => {
    expect(storedKeySet.webKeySet.jwk("both")).toStrictEqual({
      alg: "ES512",
      crv: "P-521",
      d: "AftXcyqeRTv8CEk2iDxwr9cmSzGZdKOgQF4DComwunvIhSPVuGCK2WEyJxw6agP8DXe-uF4pFlrHvY0UcCi2MtNi",
      exp: 4070908800,
      expires_in: 2493043200,
      iat: 1577174400,
      jku: "https://example.com/jwks.json",
      key_ops: ["sign", "verify"],
      kid: "971c8839-af23-545f-8e2b-2f31d3e3af11",
      kty: "EC",
      nbf: 1577836800,
      owner_id: "2ce9eb4b-1088-577e-a065-c3383e7c821f",
      uat: 1577520000,
      use: "sig",
      x: "AXLDVJ0QoP1LPZeiN-OoI9WiKWrlhJmMsGZm1cbbHrJ1FRbdD8gvuR8S0rJwnjbP1SE_hp16_KY0FDgnTb9jH-Oz",
      y: "AZwox6nbyvzbmRQTrgtuxRzxvj-mAocRfZtH2fVXDm4lFYS08pUFd5X12TQPUj_X-INglGRzc7BnX4xhY3fWLmu2",
    });
  });

  test("should set expiresAt date", () => {
    storedKeySet.webKeySet.expiresAt = new Date("2020-01-01T08:10:00.000Z");

    expect(storedKeySet.webKeySet.expiresAt).toStrictEqual(new Date("2020-01-01T08:10:00.000Z"));
    expect(storedKeySet.webKeySet.expiresIn).toBe(600);
  });

  test("should set notBefore date", () => {
    storedKeySet.webKeySet.notBefore = new Date("2020-01-01T08:10:00.000Z");

    expect(storedKeySet.webKeySet.notBefore).toStrictEqual(new Date("2020-01-01T08:10:00.000Z"));
  });

  test("should set operations", () => {
    storedKeySet.webKeySet.operations = ["deriveBits"];

    expect(storedKeySet.webKeySet.operations).toStrictEqual(["deriveBits"]);
  });

  test("should get json", () => {
    expect(storedKeySet.toJSON()).toStrictEqual({
      id: "971c8839-af23-545f-8e2b-2f31d3e3af11",
      algorithm: "ES512",
      created: new Date("2019-12-24T08:00:00.000Z"),
      curve: "P-521",
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      isExternal: false,
      jwkUri: "https://example.com/jwks.json",
      notBefore: new Date("2020-01-01T00:00:00.000Z"),
      operations: ["sign", "verify"],
      ownerId: "2ce9eb4b-1088-577e-a065-c3383e7c821f",
      privateKey:
        "MIHuAgEAMBAGByqGSM49AgEGBSuBBAAjBIHWMIHTAgEBBEIB-1dzKp5FO_wISTaIPHCv1yZLMZl0o6BAXgMKibC6e8iFI9W4YIrZYTInHDpqA_wNd764XikWWse9jRRwKLYy02KhgYkDgYYABAFyw1SdEKD9Sz2XojfjqCPVoilq5YSZjLBmZtXG2x6ydRUW3Q_IL7kfEtKycJ42z9UhP4adevymNBQ4J02_Yx_jswGcKMep28r825kUE64LbsUc8b4_pgKHEX2bR9n1Vw5uJRWEtPKVBXeV9dk0D1I_1_iDYJRkc3OwZ1-MYWN31i5rtg",
      publicKey:
        "MIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQBcsNUnRCg_Us9l6I346gj1aIpauWEmYywZmbVxtsesnUVFt0PyC-5HxLSsnCeNs_VIT-GnXr8pjQUOCdNv2Mf47MBnCjHqdvK_NuZFBOuC27FHPG-P6YChxF9m0fZ9VcObiUVhLTylQV3lfXZNA9SP9f4g2CUZHNzsGdfjGFjd9Yua7Y",
      revision: 0,
      type: "EC",
      updated: new Date("2019-12-28T08:00:00.000Z"),
      use: "sig",
      version: 0,
    });
  });

  test("should validate schema", async () => {
    await expect(KEY_PAIR_SIG_EC.schemaValidation()).resolves.not.toThrow();
  });

  test("should create from jwk", () => {
    const ks = WebKeySet.fromJwk({
      alg: "ES512",
      crv: "P-521",
      d: "AftXcyqeRTv8CEk2iDxwr9cmSzGZdKOgQF4DComwunvIhSPVuGCK2WEyJxw6agP8DXe-uF4pFlrHvY0UcCi2MtNi",
      exp: 4070908800,
      expires_in: 2493043200,
      iat: 1577174400,
      jku: "https://example.com/jwks.json",
      key_ops: ["sign", "verify"],
      kid: "971c8839-af23-545f-8e2b-2f31d3e3af11",
      kty: "EC",
      nbf: 1577836800,
      owner_id: "2ce9eb4b-1088-577e-a065-c3383e7c821f",
      use: "sig",
      x: "AXLDVJ0QoP1LPZeiN-OoI9WiKWrlhJmMsGZm1cbbHrJ1FRbdD8gvuR8S0rJwnjbP1SE_hp16_KY0FDgnTb9jH-Oz",
      y: "AZwox6nbyvzbmRQTrgtuxRzxvj-mAocRfZtH2fVXDm4lFYS08pUFd5X12TQPUj_X-INglGRzc7BnX4xhY3fWLmu2",
    });

    const kp = StoredKeySet.fromWebKeySet(ks);

    expect(kp.toJSON()).toStrictEqual({
      algorithm: "ES512",
      created: new Date("2020-01-01T08:00:00.000Z"),
      curve: "P-521",
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      id: "971c8839-af23-545f-8e2b-2f31d3e3af11",
      isExternal: true,
      jwkUri: "https://example.com/jwks.json",
      notBefore: new Date("2020-01-01T00:00:00.000Z"),
      operations: ["sign", "verify"],
      ownerId: "2ce9eb4b-1088-577e-a065-c3383e7c821f",
      privateKey:
        "MIHuAgEAMBAGByqGSM49AgEGBSuBBAAjBIHWMIHTAgEBBEIB-1dzKp5FO_wISTaIPHCv1yZLMZl0o6BAXgMKibC6e8iFI9W4YIrZYTInHDpqA_wNd764XikWWse9jRRwKLYy02KhgYkDgYYABAFyw1SdEKD9Sz2XojfjqCPVoilq5YSZjLBmZtXG2x6ydRUW3Q_IL7kfEtKycJ42z9UhP4adevymNBQ4J02_Yx_jswGcKMep28r825kUE64LbsUc8b4_pgKHEX2bR9n1Vw5uJRWEtPKVBXeV9dk0D1I_1_iDYJRkc3OwZ1-MYWN31i5rtg",
      publicKey:
        "MIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQBcsNUnRCg_Us9l6I346gj1aIpauWEmYywZmbVxtsesnUVFt0PyC-5HxLSsnCeNs_VIT-GnXr8pjQUOCdNv2Mf47MBnCjHqdvK_NuZFBOuC27FHPG-P6YChxF9m0fZ9VcObiUVhLTylQV3lfXZNA9SP9f4g2CUZHNzsGdfjGFjd9Yua7Y",
      revision: 0,
      type: "EC",
      updated: new Date("2020-01-01T08:00:00.000Z"),
      use: "sig",
      version: 0,
    });
  });
});
