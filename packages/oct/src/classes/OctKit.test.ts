import { TEST_OCT_KEY } from "../__fixtures__/keys";
import { OctError } from "../errors";
import { OctKit } from "./OctKit";

describe("OctKit", () => {
  let kit: OctKit;
  let signature: string;

  beforeEach(() => {
    kit = new OctKit({
      kryptos: TEST_OCT_KEY,
    });
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
    expect(() => kit.assert("wrong", signature)).toThrow(OctError);
  });
});
