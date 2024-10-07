import { quotation } from "./quotation";

describe("quotation", () => {
  test("should return quoted string", () => {
    expect(quotation("test")).toBe('"test"');
  });

  test("should clean up any added quotes", () => {
    expect(quotation('"test""')).toBe('"test"');
  });

  test("should trim the string", () => {
    expect(quotation(' " test  ""  ')).toBe('"test"');
  });
});
