import {
  camelArray,
  camelKeys,
  pascalArray,
  pascalCase,
  pascalKeys,
  snakeArray,
  snakeKeys,
} from "./case-switch";

describe("camelArray", () => {
  test("should convert array values", () => {
    expect(camelArray(["camelCase", "snake_case", "PascalCase"])).toStrictEqual([
      "camelCase",
      "snakeCase",
      "pascalCase",
    ]);
  });

  test("should throw on invalid type", () => {
    const input: any = "string";
    expect(() => camelArray(input)).toThrow(Error);
  });
});

describe("camelKeys", () => {
  test("should convert object keys to camelCase", () => {
    expect(
      camelKeys({
        snake_one: "one",
        snake_two: 2,
        snake_three: true,
        camelOne: ["mock"],
      }),
    ).toStrictEqual({
      camelOne: ["mock"],
      snakeOne: "one",
      snakeThree: true,
      snakeTwo: 2,
    });
  });

  test("should convert nested objects to camelCase", () => {
    expect(
      camelKeys({
        snake_one: "one",
        snake_two: {
          object_one: 1,
          object_two: "two",
          nested_object: {
            nested_one: "one",
            nested_two: ["array"],
          },
        },
      }),
    ).toStrictEqual({
      snakeOne: "one",
      snakeTwo: {
        nestedObject: {
          nestedOne: "one",
          nestedTwo: ["array"],
        },
        objectOne: 1,
        objectTwo: "two",
      },
    });
  });

  test("should throw on invalid type", () => {
    const string: any = "string";
    expect(() => camelKeys(string)).toThrow(Error);

    const error: any = new Error("error");
    expect(() => camelKeys(error)).toThrow(Error);

    const date: any = new Date();
    expect(() => camelKeys(date)).toThrow(Error);

    const array: any = ["array"];
    expect(() => camelKeys(array)).toThrow(Error);
  });
});

describe("snakeArray", () => {
  test("should convert array values to snake_case", () => {
    expect(snakeArray(["camelCase", "snake_case", "PascalCase"])).toStrictEqual([
      "camel_case",
      "snake_case",
      "pascal_case",
    ]);
  });
});

describe("snakeKeys", () => {
  test("should convert object keys to snake_case", () => {
    expect(
      snakeKeys({
        camelOne: "one",
        camelTwo: 2,
        snake_one: "mock",
      }),
    ).toStrictEqual({
      camel_one: "one",
      camel_two: 2,
      snake_one: "mock",
    });
  });
});

describe("pascalCase", () => {
  test("should convert string to PascalCase", () => {
    expect(pascalCase("mock_string_one")).toBe("MockStringOne");
    expect(pascalCase("mockStringTwo")).toBe("MockStringTwo");
  });
});

describe("pascalArray", () => {
  test("should convert array values to PascalCase", () => {
    expect(pascalArray(["camelCase", "snake_case", "PascalCase"])).toStrictEqual([
      "CamelCase",
      "SnakeCase",
      "PascalCase",
    ]);
  });
});

describe("pascalKeys", () => {
  test("should convert object keys to PascalCase", () => {
    expect(
      pascalKeys({
        camelOne: "one",
        snake_one: "one",
      }),
    ).toStrictEqual({
      CamelOne: "one",
      SnakeOne: "one",
    });
  });
});
