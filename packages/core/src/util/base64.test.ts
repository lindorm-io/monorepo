import { baseHash, baseParse } from "./base64";

describe("base-hash.ts", () => {
  test("should hash a string", () => {
    expect(baseHash("mock-input")).toBe("bW9jay1pbnB1dA==");
  });

  test("should parse a string", () => {
    expect(baseParse("c3RyaW5n")).toBe("string");
  });
});
