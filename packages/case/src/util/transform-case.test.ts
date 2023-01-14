import { transformCase } from "./transform-case";

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

describe("transformCase", () => {
  test("should convert camel case string", () => {
    expect(transformCase(inputCamel, "snake")).toMatchSnapshot();
  });

  test("should convert param case string", () => {
    expect(transformCase(inputParam, "camel")).toMatchSnapshot();
  });

  test("should convert pascal case string", () => {
    expect(transformCase(inputPascal, "param")).toMatchSnapshot();
  });

  test("should convert snake case string", () => {
    expect(transformCase(inputSnake, "pascal")).toMatchSnapshot();
  });

  test("should convert array values", () => {
    expect(transformCase(inputArray, "camel")).toMatchSnapshot();
  });

  test("should convert object keys to camelCase", () => {
    expect(transformCase(inputObject, "pascal")).toMatchSnapshot();
  });

  test("should not convert", () => {
    expect(transformCase(inputParam, "none")).toMatchSnapshot();
  });

  test("should throw on invalid type", () => {
    const number: any = 1234;
    expect(() => transformCase(number, "param")).toThrow(Error);

    const error: any = new Error("error");
    expect(() => transformCase(error, "snake")).toThrow(Error);

    const date: any = new Date();
    expect(() => transformCase(date, "camel")).toThrow(Error);
  });

  test("should throw on invalid mode", () => {
    // @ts-ignore
    expect(() => transformCase(inputCamel, "error")).toThrow(Error);
  });
});
