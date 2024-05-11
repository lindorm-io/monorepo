import { HmacError } from "../errors";
import { HmacKit } from "./HmacKit";

describe("HmacKit", () => {
  let kit: HmacKit;
  let signature: string;

  beforeEach(() => {
    kit = new HmacKit({
      secret: "mock-secret",
    });
    signature = kit.hash("string");
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
    expect(() => kit.assert("wrong", signature)).toThrow(HmacError);
  });
});
