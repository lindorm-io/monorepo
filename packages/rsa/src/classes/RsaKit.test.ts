import { randomBytes } from "crypto";
import { TEST_RSA_KEY } from "../__fixtures__/keys";
import { RsaError } from "../errors";
import { RsaKit } from "./RsaKit";

describe("RsaKit", () => {
  let kit: RsaKit;
  let data: string;
  let hash: string;

  beforeEach(() => {
    data = randomBytes(32).toString("hex");
    kit = new RsaKit({ kryptos: TEST_RSA_KEY });
    hash = kit.sign(data);
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
