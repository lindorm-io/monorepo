import { snakeCase } from "./snake-case";

const inputCamel = "camelCase";
const inputParam = "param-case";
const inputPascal = "PascalCase";
const inputSnake = "snake_case";

const inputArray = ["camelCase", "param-case", "PascalCase", "snake_case"];

const inputObject = {
  camelString: "camelString",
  "param-string": "param-string",
  PascalString: "PascalString",
  snake_string: "snake_string",

  camelObject: {
    camelObjectString: "camelObjectString",
    "camel-object-string": "camel-object-string",
    CamelObjectString: "CamelObjectString",
    camel_object_string: "camel_object_string",
  },
  "param-object": {
    paramObjectString: "paramObjectString",
    "param-object-string": "param-object-string",
    ParamObjectString: "ParamObjectString",
    param_object_string: "param_object_string",
  },
  PascalObject: {
    pascalObjectString: "pascalObjectString",
    "pascal-object-string": "pascal-object-string",
    PascalObjectString: "PascalObjectString",
    pascal_object_string: "pascal_object_string",
  },
  snake_object: {
    snakeObjectString: "snakeObjectString",
    "snake-object-string": "snake-object-string",
    SnakeObjectString: "SnakeObjectString",
    snake_object_string: "snake_object_string",
  },

  camelArray: [
    "camelArrayString",
    "camel-array-string",
    "CamelArrayString",
    "camel_array_string",
    {
      camelObjectString: "camelObjectString",
      "camel-object-string": "camel-object-string",
      CamelObjectString: "CamelObjectString",
      camel_object_string: "camel_object_string",
    },
  ],
  "param-array": [
    "paramArrayString",
    "param-array-string",
    "ParamArrayString",
    "param_array_string",
    {
      paramObjectString: "paramObjectString",
      "param-object-string": "param-object-string",
      ParamObjectString: "ParamObjectString",
      param_object_string: "param_object_string",
    },
  ],
  PascalArray: [
    "pascalArrayString",
    "pascal-array-string",
    "PascalArrayString",
    "pascal_array_string",
    {
      pascalObjectString: "pascalObjectString",
      "pascal-object-string": "pascal-object-string",
      PascalObjectString: "PascalObjectString",
      pascal_object_string: "pascal_object_string",
    },
  ],
  snake_array: [
    "snakeArrayString",
    "snake-array-string",
    "SnakeArrayString",
    "snake_array_string",
    {
      snakeObjectString: "snakeObjectString",
      "snake-object-string": "snake-object-string",
      SnakeObjectString: "SnakeObjectString",
      snake_object_string: "snake_object_string",
    },
  ],
};

describe("camelCase", () => {
  test("should convert camel case string", () => {
    expect(snakeCase(inputCamel)).toMatchSnapshot();
  });

  test("should convert param case string", () => {
    expect(snakeCase(inputParam)).toMatchSnapshot();
  });

  test("should convert pascal case string", () => {
    expect(snakeCase(inputPascal)).toMatchSnapshot();
  });

  test("should convert snake case string", () => {
    expect(snakeCase(inputSnake)).toMatchSnapshot();
  });

  test("should convert array values", () => {
    expect(snakeCase(inputArray)).toMatchSnapshot();
  });

  test("should convert object keys to camelCase", () => {
    expect(snakeCase(inputObject)).toMatchSnapshot();
  });

  test("should throw on invalid type", () => {
    const number: any = 1234;
    expect(() => snakeCase(number)).toThrow(Error);

    const error: any = new Error("error");
    expect(() => snakeCase(error)).toThrow(Error);

    const date: any = new Date();
    expect(() => snakeCase(date)).toThrow(Error);
  });
});
