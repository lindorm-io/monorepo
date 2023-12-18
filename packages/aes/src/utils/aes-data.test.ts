import { randomBytes } from "crypto";
import { AesError } from "../errors";
import { assertAesCipher, decryptAesCipher, encryptAesCipher, verifyAesCipher } from "./aes-cipher";

describe("aes-data", () => {
  test("should encrypt and decrypt a cipher string", () => {
    const data = randomBytes(32).toString("hex");
    const secret = randomBytes(16).toString("hex");
    const cipher = encryptAesCipher({
      data,
      secret,
    });

    expect(cipher).toContain("$aes-256-gcm$");
    expect(cipher).toContain("v=");
    expect(cipher).toContain("f=b64u");
    expect(cipher).toContain("iv=");
    expect(cipher).toContain("tag=");

    expect(decryptAesCipher({ cipher, secret })).toBe(data);
  });

  test("should encrypt and verify a valid cipher string", () => {
    const data = randomBytes(32).toString("hex");
    const secret = randomBytes(16).toString("hex");
    const cipher = encryptAesCipher({
      data,
      secret,
    });

    expect(verifyAesCipher({ cipher, data, secret })).toBe(true);
  });

  test("should encrypt and reject an invalid cipher string", () => {
    const data = randomBytes(32).toString("hex");
    const secret = randomBytes(16).toString("hex");
    const cipher = encryptAesCipher({
      data,
      secret,
    });

    expect(verifyAesCipher({ cipher, data: "wrong", secret })).toBe(false);
  });

  test("should encrypt and assert a valid cipher string", () => {
    const data = randomBytes(32).toString("hex");
    const secret = randomBytes(16).toString("hex");
    const cipher = encryptAesCipher({
      data,
      secret,
    });

    expect(() => assertAesCipher({ cipher, data, secret })).not.toThrow();
  });

  test("should encrypt and throw on an invalid a cipher string", () => {
    const data = randomBytes(32).toString("hex");
    const secret = randomBytes(16).toString("hex");
    const cipher = encryptAesCipher({
      data,
      secret,
    });

    expect(() => assertAesCipher({ cipher, data: "wrong", secret })).toThrow(AesError);
  });
});
