import { Kryptos } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { AesError } from "../errors";
import { AesCipher } from "./AesCipher";

describe("AesCipher", () => {
  let aesCipher: AesCipher;
  let string: string;
  let cipher: string;

  beforeEach(async () => {
    const kryptos = await Kryptos.generate("oct");

    string = randomBytes(32).toString("hex");
    aesCipher = new AesCipher({ kryptos });
    cipher = aesCipher.encrypt(string);
  });

  test("should encrypt", () => {
    expect(cipher).toStrictEqual(expect.any(String));
    expect(cipher).not.toBe(string);
  });

  test("should decrypt", () => {
    expect(aesCipher.decrypt(cipher)).toBe(string);
  });

  test("should verify", () => {
    expect(aesCipher.verify(string, cipher)).toBe(true);
  });

  test("should reject", () => {
    expect(aesCipher.verify("wrong", cipher)).toBe(false);
  });

  test("should assert", () => {
    expect(() => aesCipher.assert(string, cipher)).not.toThrow();
  });

  test("should throw error", () => {
    expect(() => aesCipher.assert("wrong", cipher)).toThrow(AesError);
  });
});
