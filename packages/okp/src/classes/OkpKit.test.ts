import { TEST_OKP_KEY_25519 } from "../__fixtures__/keys";
import { OkpError } from "../errors";
import { OkpKit } from "./OkpKit";

describe("OkpKit", () => {
  let kit: OkpKit;
  let signature: string;

  beforeEach(() => {
    kit = new OkpKit({ kryptos: TEST_OKP_KEY_25519 });
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
