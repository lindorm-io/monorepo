import { randomBytes } from "crypto";
import { RSA_KEYS } from "../__fixtures__/rsa-keys.fixture";
import { RsaError } from "../errors";
import { RsaKit } from "./RsaKit";

describe("RsaKit", () => {
  let kit: RsaKit;
  let data: string;
  let hash: string;

  beforeEach(() => {
    data = randomBytes(32).toString("hex");
    kit = new RsaKit({ kryptos: RSA_KEYS });
    hash = kit.hash(data);
  });

  test("should sign", () => {
    expect(hash).toEqual(expect.any(String));
    expect(hash).not.toEqual(data);
  });

  test("should verify", () => {
    expect(kit.verify(data, hash)).toEqual(true);
  });

  test("should reject", () => {
    expect(kit.verify("wrong", hash)).toEqual(false);
  });

  test("should assert", () => {
    expect(() => kit.assert(data, hash)).not.toThrow();
  });

  test("should throw error", () => {
    expect(() => kit.assert("wrong", hash)).toThrow(RsaError);
  });
});
