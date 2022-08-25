import { extractDtoData } from "./extract-dto-data";

class FirstTest {
  constructor(public readonly one: string) {}
}

class SecondTest_V2 {
  constructor(public readonly two: string) {}
}

class V3ThirdTest {
  constructor(public readonly three: string) {}
}

describe("extractDtoData", () => {
  test("should extract name and data", () => {
    expect(extractDtoData(new FirstTest("one"))).toStrictEqual({
      data: { one: "one" },
      name: "first_test",
      version: 1,
    });
  });

  test("should extract version", () => {
    expect(extractDtoData(new SecondTest_V2("two"))).toStrictEqual({
      data: { two: "two" },
      name: "second_test",
      version: 2,
    });
  });

  test("should only match version at end of name", () => {
    expect(extractDtoData(new V3ThirdTest("three"))).toStrictEqual({
      data: { three: "three" },
      name: "v_3_third_test",
      version: 1,
    });
  });
});
