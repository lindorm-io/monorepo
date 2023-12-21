import { ServerError } from "@lindorm-io/errors";
import { encryptJwe as _encryptJwe } from "@lindorm-io/jwt";
import { Client } from "../../entity";
import { createTestClient } from "../../fixtures/entity";
import { encryptIdToken } from "./encrypt-id-token";

jest.mock("@lindorm-io/jwt");

const encryptJwe = _encryptJwe as jest.Mock;

const JWK = {
  alg: "RS512",
  keyOps: ["decrypt", "verify"],
  kid: "2d60172d-ac8a-4eaf-8ccd-873fc22dcb28",
  kty: "RSA",
  use: "sig",
  n: "yjql5hIlllH81iamrW5BtOjIc9TKD0+dMazmKhKq/waqKcYtgI06p4YmF940f3OW8dKKXRLBbvu++VBN6/RMP9JFpYg1r4U1UbqwDMFeRRFiMZgH86FW6KhhyECxkWm6/5NRdu7cEw5mNVi08i0MsxuvFWEvSTArBLP5Ctw9m3KNza/HRlO4oVPaiwtxadTlqyYsFr2cEwjZvAadrrj1tLiasCX/UcmBE5Csoo8hayUXdM9hofg2QBXYGKiRTCr5WnxIKfagmzhGdClmZw6C+/8QWogm3tREq52IX5DPwEjUJ0Lq2AZ2O7HMpMx0NwkwrDSysT6K+klphyrpe1WG0RvEzeSQ7jfRf5Xe997LPv5LB6nFz4HtOaVcM2sEGHqS9iPWByAX4Y+2zvQvbDQPAcpEVojPRWJeZLEYJUvIhEeZ5Q9pOobF0qKH3dxxZNSDCXkVSrne6au7sfSR7toqqnBSOTpWCluzw1SjYBKd6cP0tNgkjUEvJFb1QsAV3GNbppFch4LCc5/MSX07l1MdlZ44H8TYAA20VWmsYBW00EFRITe0bNIAxl5wos3NLduozOMZwWRXawDWUQqejeJjggM2QtO0yuRuvVFlhQqs5sHz8fsux7RIkE/gVDy51ai+hUQ4GL3o0ELSsLzfTzUhRvUqSW8/kAf5GZnygQgGrMs=",
  e: "AQAB",
};

describe("encryptIdToken", () => {
  let ctx: any;
  let client: Client;

  beforeEach(() => {
    ctx = {
      axios: {
        axiosClient: {
          get: jest.fn().mockResolvedValue({ data: { keys: [JWK] } }),
        },
      },
    };

    client = createTestClient({
      jwks: ["test"],
    });

    encryptJwe.mockReturnValue("jwe");
  });

  afterEach(jest.clearAllMocks);

  test("should resolve with local jwks", async () => {
    await expect(encryptIdToken(ctx, client, "token")).resolves.toBe("jwe");

    expect(ctx.axios.axiosClient.get).not.toHaveBeenCalled();

    expect(encryptJwe).toHaveBeenCalledWith({
      algorithm: "aes-256-gcm",
      encryptionKeyAlgorithm: "RSA-OAEP-256",
      key: "test",
      keyId: undefined,
      token: "token",
    });
  });

  test("should resolve with jwks from uri", async () => {
    client.jwks = [];

    await expect(encryptIdToken(ctx, client, "token")).resolves.toBe("jwe");

    expect(ctx.axios.axiosClient.get).toHaveBeenCalled();

    expect(encryptJwe).toHaveBeenCalledWith({
      algorithm: "aes-256-gcm",
      encryptionKeyAlgorithm: "RSA-OAEP-256",
      key:
        "-----BEGIN RSA PUBLIC KEY-----\n" +
        "MIICCgKCAgEAyjql5hIlllH81iamrW5BtOjIc9TKD0+dMazmKhKq/waqKcYtgI06\n" +
        "p4YmF940f3OW8dKKXRLBbvu++VBN6/RMP9JFpYg1r4U1UbqwDMFeRRFiMZgH86FW\n" +
        "6KhhyECxkWm6/5NRdu7cEw5mNVi08i0MsxuvFWEvSTArBLP5Ctw9m3KNza/HRlO4\n" +
        "oVPaiwtxadTlqyYsFr2cEwjZvAadrrj1tLiasCX/UcmBE5Csoo8hayUXdM9hofg2\n" +
        "QBXYGKiRTCr5WnxIKfagmzhGdClmZw6C+/8QWogm3tREq52IX5DPwEjUJ0Lq2AZ2\n" +
        "O7HMpMx0NwkwrDSysT6K+klphyrpe1WG0RvEzeSQ7jfRf5Xe997LPv5LB6nFz4Ht\n" +
        "OaVcM2sEGHqS9iPWByAX4Y+2zvQvbDQPAcpEVojPRWJeZLEYJUvIhEeZ5Q9pOobF\n" +
        "0qKH3dxxZNSDCXkVSrne6au7sfSR7toqqnBSOTpWCluzw1SjYBKd6cP0tNgkjUEv\n" +
        "JFb1QsAV3GNbppFch4LCc5/MSX07l1MdlZ44H8TYAA20VWmsYBW00EFRITe0bNIA\n" +
        "xl5wos3NLduozOMZwWRXawDWUQqejeJjggM2QtO0yuRuvVFlhQqs5sHz8fsux7RI\n" +
        "kE/gVDy51ai+hUQ4GL3o0ELSsLzfTzUhRvUqSW8/kAf5GZnygQgGrMsCAwEAAQ==\n" +
        "-----END RSA PUBLIC KEY-----\n",
      keyId: "2d60172d-ac8a-4eaf-8ccd-873fc22dcb28",
      token: "token",
    });
  });

  test("should throw on missing id token algorithm", async () => {
    client.idTokenEncryption.algorithm = null;

    await expect(encryptIdToken(ctx, client, "token")).rejects.toThrow(ServerError);
  });

  test("should throw on missing rsa keys", async () => {
    client.jwks = [];

    ctx.axios.axiosClient.get.mockResolvedValue({ data: { keys: [] } });

    await expect(encryptIdToken(ctx, client, "token")).rejects.toThrow(ServerError);
  });

  test("should throw on unresolved key", async () => {
    client.jwks = [];
    client.jwksUri = null;

    await expect(encryptIdToken(ctx, client, "token")).rejects.toThrow(ServerError);
  });
});
