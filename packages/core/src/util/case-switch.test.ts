import {
  camelArray,
  camelKeys,
  pascalArray,
  pascalCase,
  pascalKeys,
  snakeArray,
  snakeKeys,
} from "./case-switch";

const inputArray = ["snake_case", "camelCase", "PascalCase"];

const inputObject = {
  at_snake: "at_snake",
  boCamel: "boCamel",
  CePascal: "CePascal",

  de_snake_object: {
    at_one: "at_one",
    boTwo: "boTwo",
    CeThree: "CeThree",
  },
  ekCamelObject: {
    at_one: "at_one",
    boTwo: "boTwo",
    CeThree: "CeThree",
  },
  FaPascalObject: {
    at_one: "at_one",
    boTwo: "boTwo",
    CeThree: "CeThree",
  },

  gi_snake_array: [
    "snake_value",
    "camelValue",
    "PascalValue",
    {
      at_snake_object_value: "at_snake_object_value",
      boCamelObjectValue: "boCamelObjectValue",
      CePascalObjectValue: "CePascalObjectValue",
    },
  ],
  haCamelArray: [
    "snake_value",
    "camelValue",
    "PascalValue",
    {
      at_snake_object_value: "at_snake_object_value",
      boCamelObjectValue: "boCamelObjectValue",
      CePascalObjectValue: "CePascalObjectValue",
    },
  ],
  ItPascalArray: [
    "snake_value",
    "camelValue",
    "PascalValue",
    {
      at_snake_object_value: "at_snake_object_value",
      boCamelObjectValue: "boCamelObjectValue",
      CePascalObjectValue: "CePascalObjectValue",
    },
  ],
};

describe("camelArray", () => {
  test("should convert array values", () => {
    expect(camelArray(inputArray)).toMatchSnapshot();
  });

  test("should throw on invalid type", () => {
    const input: any = "string";
    expect(() => camelArray(input)).toThrow(Error);
  });
});

describe("camelKeys", () => {
  test("should convert object keys to camelCase", () => {
    expect(camelKeys(inputObject)).toMatchSnapshot();
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
    expect(snakeArray(inputArray)).toMatchSnapshot();
  });
});

describe("snakeKeys", () => {
  test("should convert object keys to snake_case", () => {
    expect(snakeKeys(inputObject)).toMatchSnapshot();
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
    expect(pascalArray(inputArray)).toMatchSnapshot();
  });
});

describe("pascalKeys", () => {
  test("should convert object keys to PascalCase", () => {
    expect(pascalKeys(inputObject)).toMatchSnapshot();
  });
});
