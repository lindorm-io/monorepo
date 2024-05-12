import { TEST_EC_KEY } from "../__fixtures__/keys";
import { EcError } from "../errors";
import { EcKit } from "./EcKit";

describe("EcKit", () => {
  let kit: EcKit;
  let signature: string;

  beforeEach(() => {
    kit = new EcKit({ kryptos: TEST_EC_KEY });
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
    expect(() => kit.assert("wrong", signature)).toThrow(EcError);
  });
});
