import { sec } from "./sec";

describe("sec", () => {
  test("should resolve seconds", () => {
    expect(sec("4 seconds")).toEqual(4);
  });

  test("should resolve readable time", () => {
    expect(sec(5)).toEqual("5s");
  });
});
