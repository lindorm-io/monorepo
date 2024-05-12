import { TEST_OKP_KEY } from "../__fixtures__/keys";
import { OkpError } from "../errors";
import { OkpKit } from "./OkpKit";

describe("OkpKit", () => {
  let kit: OkpKit;
  let signature: string;

  beforeEach(() => {
    kit = new OkpKit({ kryptos: TEST_OKP_KEY });
    signature = kit.sign("string");
  });

  test("should verify", () => {
    expect(kit.verify("string", signature)).toBe(true);
  });

  test("should reject", () => {
    expect(kit.verify("wrong", signature)).toBe(false);
  });

  test("should assert", () => {
    expect(() => kit.assert("string", signature)).not.toThrow();
  });

  test("should throw error", () => {
    expect(() => kit.assert("wrong", signature)).toThrow(OkpError);
  });
});
