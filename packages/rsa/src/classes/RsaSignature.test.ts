import { randomBytes } from "crypto";
import { RsaError } from "../errors";
import { RSA_KEY_SET } from "../fixtures/rsa-keys.fixture";
import { RsaSignature } from "./RsaSignature";

describe("RsaSignature", () => {
  let rsaSignature: RsaSignature;
  let string: string;
  let signature: string;

  beforeEach(() => {
    string = randomBytes(32).toString("hex");
    rsaSignature = new RsaSignature({ keySet: RSA_KEY_SET });
    signature = rsaSignature.sign(string);
  });

  test("should sign", () => {
    expect(signature).toStrictEqual(expect.any(String));
    expect(signature).not.toBe(string);
  });

  test("should verify", () => {
    expect(rsaSignature.verify(string, signature)).toBe(true);
  });

  test("should reject", () => {
    expect(rsaSignature.verify("wrong", signature)).toBe(false);
  });

  test("should assert", () => {
    expect(() => rsaSignature.assert(string, signature)).not.toThrow();
  });

  test("should throw error", () => {
    expect(() => rsaSignature.assert("wrong", signature)).toThrow(RsaError);
  });
});
