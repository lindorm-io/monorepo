import { ShaError } from "../errors";
import { ShaKit } from "./ShaKit";

describe("ShaKit", () => {
  let kit: ShaKit;
  let hash: string;

  beforeEach(() => {
    kit = new ShaKit();
    hash = kit.hash("string");
  });

  test("should verify", () => {
    expect(kit.verify("string", hash)).toEqual(true);
  });

  test("should reject", () => {
    expect(kit.verify("wrong", hash)).toEqual(false);
  });

  test("should assert", () => {
    expect(() => kit.assert("string", hash)).not.toThrow();
  });

  test("should throw error", () => {
    expect(() => kit.assert("wrong", hash)).toThrow(ShaError);
  });
});
