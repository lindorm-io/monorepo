import {
  TEST_DICT,
  TEST_STRING_ARRAY,
  TEST_STRING_JSON,
} from "../__fixtures__/test-data";
import { JsonKit } from "./JsonKit";
import { Primitive } from "./Primitive";

describe("JsonKit", () => {
  test("should create a primitive buffer from json data", () => {
    expect(JsonKit.buffer(TEST_DICT).toString("base64")).toMatchSnapshot();
  });

  test("should parse a primitive string (array) to json data", () => {
    expect(JsonKit.parse(TEST_STRING_ARRAY)).toMatchSnapshot();
  });

  test("should parse a primitive string (json) to json data", () => {
    expect(JsonKit.parse(TEST_STRING_JSON)).toMatchSnapshot();
  });

  test("should create a Primitive instance from json data", () => {
    expect(JsonKit.primitive(TEST_DICT)).toBeInstanceOf(Primitive);
  });

  test("should create a primitive string from json data", () => {
    expect(JsonKit.stringify(TEST_DICT)).toMatchSnapshot();
  });
});
