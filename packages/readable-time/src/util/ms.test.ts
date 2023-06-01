import { ms } from "./ms";

describe("ms", () => {
  test("should resolve milliseconds", () => {
    expect(ms("4 seconds")).toBe(4000);
  });

  test("should resolve readable time", () => {
    expect(ms(5000)).toBe("5s");
  });
});
