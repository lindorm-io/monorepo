import { Kryptos } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { LATEST_AES_VERSION } from "../constants";
import { AesError } from "../errors";
import { AesKit } from "./AesKit";

describe("AesKit", () => {
  let aesKit: AesKit;
  let string: string;
  let cipher: string;

  beforeEach(async () => {
    const kryptos = Kryptos.generate({
      algorithm: "dir",
      encryption: "A256GCM",
      type: "oct",
      use: "enc",
    });

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
      algorithm: "dir",
      authTag: expect.any(Buffer),
      content: expect.any(Buffer),
      encryption: "A256GCM",
      format: "base64url",
      hkdfSalt: undefined,
      initialisationVector: expect.any(Buffer),
      keyId: expect.any(Buffer),
      pbkdfIterations: undefined,
      pbkdfSalt: undefined,
      publicEncryptionJwk: undefined,
      publicEncryptionKey: undefined,
      version: LATEST_AES_VERSION,
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
