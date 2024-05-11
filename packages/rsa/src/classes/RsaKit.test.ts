import { randomBytes } from "crypto";
import { RSA_KEYS } from "../__fixtures__/rsa-keys.fixture";
import { RsaError } from "../errors";
import { RsaKit } from "./RsaKit";

describe("RsaKit", () => {
  let rsaKit: RsaKit;
  let string: string;
  let signature: string;

  beforeEach(() => {
    string = randomBytes(32).toString("hex");
    rsaKit = new RsaKit({ kryptos: RSA_KEYS });
    signature = rsaKit.sign(string);
  });

  test("should sign", () => {
    expect(signature).toEqual(expect.any(String));
    expect(signature).not.toEqual(string);
  });

  test("should verify", () => {
    expect(rsaKit.verify(string, signature)).toEqual(true);
  });

  test("should reject", () => {
    expect(rsaKit.verify("wrong", signature)).toEqual(false);
  });

  test("should assert", () => {
    expect(() => rsaKit.assert(string, signature)).not.toThrow();
  });

  test("should throw error", () => {
    expect(() => rsaKit.assert("wrong", signature)).toThrow(RsaError);
  });
});
