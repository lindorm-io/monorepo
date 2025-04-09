import { randomBytes } from "crypto";
import { TEST_RSA_KEY_RS256 } from "../__fixtures__/keys";
import { RsaError } from "../errors";
import { RsaKit } from "./RsaKit";

describe("RsaKit", () => {
  let kit: RsaKit;
  let data: Buffer;
  let signature: Buffer;

  beforeEach(() => {
    kit = new RsaKit({ kryptos: TEST_RSA_KEY_RS256 });
    data = randomBytes(32);
    signature = kit.sign(data);
  });

  test("should verify", () => {
    expect(kit.verify(data, signature)).toEqual(true);
  });

  test("should reject", () => {
    expect(kit.verify("wrong", signature)).toEqual(false);
  });

  test("should assert", () => {
    expect(() => kit.assert(data, signature)).not.toThrow();
  });

  test("should throw error", () => {
    expect(() => kit.assert("wrong", signature)).toThrow(RsaError);
  });
});
