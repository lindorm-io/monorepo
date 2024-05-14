import { Kryptos } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { AesError } from "../errors";
import { AesKit } from "./AesKit";

describe("AesKit", () => {
  let aesKit: AesKit;
  let string: string;
  let cipher: string;

  beforeEach(async () => {
    const kryptos = await Kryptos.generate("oct");

    string = randomBytes(32).toString("hex");
    aesKit = new AesKit({ kryptos });
    cipher = aesKit.encrypt(string);
  });

  test("should encrypt to cipher", () => {
    expect(cipher).toEqual(expect.any(String));
    expect(cipher).not.toEqual(string);
  });

  test("should encrypt to object", () => {
    expect(aesKit.encrypt(string, "object")).toEqual({
      authTag: expect.any(Buffer),
      content: expect.any(Buffer),
      encryption: "aes-256-gcm",
      encryptionKeyAlgorithm: undefined,
      format: "base64url",
      initialisationVector: expect.any(Buffer),
      integrityHash: "SHA256",
      keyId: expect.any(Buffer),
      publicEncryptionJwk: undefined,
      publicEncryptionKey: undefined,
      version: 6,
    });
  });

  test("should decrypt cipher", () => {
    expect(aesKit.decrypt(cipher)).toEqual(string);
  });

  test("should decrypt object", () => {
    expect(aesKit.decrypt(aesKit.encrypt(string, "object"))).toEqual(string);
  });

  test("should verify", () => {
    expect(aesKit.verify(string, cipher)).toEqual(true);
  });

  test("should reject", () => {
    expect(aesKit.verify("wrong", cipher)).toEqual(false);
  });

  test("should assert", () => {
    expect(() => aesKit.assert(string, cipher)).not.toThrow();
  });

  test("should throw error", () => {
    expect(() => aesKit.assert("wrong", cipher)).toThrow(AesError);
  });
});
