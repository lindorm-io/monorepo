import { _replaceParams } from "./replace-params";

describe("replaceParams", () => {
  test("should return with :pathName", () => {
    expect(
      _replaceParams("/pathOne/:one/pathTwo/:two/pathThree/:three/pathFour/:four", {
        one: 1,
        two: 2,
        three: 3,
        four: 4,
      }),
    ).toEqual("/pathOne/1/pathTwo/2/pathThree/3/pathFour/4");
  });

  test("should return with {pathName}", () => {
    expect(
      _replaceParams("/pathOne/{one}/pathTwo/{two}/pathThree/{three}/pathFour/{four}", {
        one: 1,
        two: 2,
        three: 3,
        four: 4,
      }),
    ).toEqual("/pathOne/1/pathTwo/2/pathThree/3/pathFour/4");
  });

  test("should throw error on missing param", () => {
    expect(() =>
      _replaceParams("/pathOne/:one/pathTwo/:two/pathThree/:three/pathFour/:four", {
        one: 1,
        two: 2,
        three: 3,
      }),
    ).toThrow();
  });

  test("should throw error on missing pathname param", () => {
    expect(() =>
      _replaceParams("/pathOne/:one/pathTwo/:two", {
        one: 1,
        two: 2,
        three: 3,
        four: 4,
      }),
    ).toThrow();
  });
});
