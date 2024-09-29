import { extractDataTransferObject } from "./extract-data-transfer-object";

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
    expect(extractDataTransferObject(new FirstTest("one"))).toEqual({
      data: { one: "one" },
      name: "first_test",
      version: 1,
    });
  });

  test("should extract version", () => {
    expect(extractDataTransferObject(new SecondTest_V2("two"))).toEqual({
      data: { two: "two" },
      name: "second_test",
      version: 2,
    });
  });

  test("should only match version at end of name", () => {
    expect(extractDataTransferObject(new V3ThirdTest("three"))).toEqual({
      data: { three: "three" },
      name: "v3_third_test",
      version: 1,
    });
  });
});
