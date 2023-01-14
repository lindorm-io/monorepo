import { headerCase } from "./header-case";

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
    expect(headerCase(inputCamel)).toMatchSnapshot();
  });

  test("should convert param case string", () => {
    expect(headerCase(inputParam)).toMatchSnapshot();
  });

  test("should convert pascal case string", () => {
    expect(headerCase(inputPascal)).toMatchSnapshot();
  });

  test("should convert snake case string", () => {
    expect(headerCase(inputSnake)).toMatchSnapshot();
  });

  test("should convert array values", () => {
    expect(headerCase(inputArray)).toMatchSnapshot();
  });

  test("should convert object keys to camelCase", () => {
    expect(headerCase(inputObject)).toMatchSnapshot();
  });

  test("should throw on invalid type", () => {
    const number: any = 1234;
    expect(() => headerCase(number)).toThrow(Error);

    const error: any = new Error("error");
    expect(() => headerCase(error)).toThrow(Error);

    const date: any = new Date();
    expect(() => headerCase(date)).toThrow(Error);
  });
});
