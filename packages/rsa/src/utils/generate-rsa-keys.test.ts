import { generateKeyPair as _generateKeyPair } from "crypto";
import { generateRsaKeys } from "./generate-rsa-keys";

jest.mock("crypto");

const generateKeyPair = _generateKeyPair as unknown as jest.Mock;

describe("generateRsaKeys", () => {
  beforeEach(() => {
    generateKeyPair.mockImplementation((_1: never, _2: never, callback: any) =>
      callback(null, "PUBLIC_KEY", "PRIVATE_KEY"),
    );
  });

  afterEach(jest.clearAllMocks);

  test("should resolve with default options", async () => {
    await expect(generateRsaKeys()).resolves.toStrictEqual({
      privateKey: "PRIVATE_KEY",
      publicKey: "PUBLIC_KEY",
    });

    expect(generateKeyPair).toHaveBeenCalledWith(
      "rsa",
      {
        modulusLength: 4096,
        publicKeyEncoding: { format: "pem", type: "pkcs1" },
        privateKeyEncoding: { format: "pem", type: "pkcs1" },
      },
      expect.any(Function),
    );
  });

  test("should resolve with modulus options", async () => {
    await expect(generateRsaKeys({ modulus: 2 })).resolves.toStrictEqual({
      privateKey: "PRIVATE_KEY",
      publicKey: "PUBLIC_KEY",
    });

    expect(generateKeyPair).toHaveBeenCalledWith(
      "rsa",
      {
        modulusLength: 2048,
        publicKeyEncoding: { format: "pem", type: "pkcs1" },
        privateKeyEncoding: { format: "pem", type: "pkcs1" },
      },
      expect.any(Function),
    );
  });

  test("should resolve with passphrase options", async () => {
    await expect(generateRsaKeys({ passphrase: "passphrase" })).resolves.toStrictEqual({
      privateKey: "PRIVATE_KEY",
      publicKey: "PUBLIC_KEY",
    });

    expect(generateKeyPair).toHaveBeenCalledWith(
      "rsa",
      {
        modulusLength: 4096,
        publicKeyEncoding: { format: "pem", type: "pkcs1" },
        privateKeyEncoding: {
          cipher: "aes-256-cbc",
          format: "pem",
          passphrase: "passphrase",
          type: "pkcs8",
        },
      },
      expect.any(Function),
    );
  });

  test("should reject", async () => {
    generateKeyPair.mockImplementation((_1: never, _2: never, callback: any) =>
      callback(new Error("Error")),
    );

    await expect(generateRsaKeys()).rejects.toThrow(Error);
  });
});
