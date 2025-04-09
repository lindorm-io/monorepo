import { randomBytes } from "crypto";
import { TEST_OKP_KEY_ED25519 } from "../__fixtures__/keys";
import { OkpError } from "../errors";
import { OkpKit } from "./OkpKit";

describe("OkpKit", () => {
  let kit: OkpKit;
  let data: Buffer;
  let signature: Buffer;

  beforeEach(() => {
    kit = new OkpKit({ kryptos: TEST_OKP_KEY_ED25519 });
    data = randomBytes(32);
    signature = kit.sign("string");
  });

  test("should verify", () => {
    expect(kit.verify("string", signature)).toEqual(true);
  });

  test("should reject", () => {
    expect(kit.verify("wrong", signature)).toEqual(false);
  });

  test("should assert", () => {
    expect(() => kit.assert("string", signature)).not.toThrow();
  });

  test("should throw error", () => {
    expect(() => kit.assert("wrong", signature)).toThrow(OkpError);
  });
});
