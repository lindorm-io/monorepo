import { ms } from "./ms";

describe("ms", () => {
  test("should resolve milliseconds", () => {
    expect(ms("4 seconds")).toEqual(4000);
  });

  test("should resolve readable time", () => {
    expect(ms(5000)).toEqual("5s");
  });
});
