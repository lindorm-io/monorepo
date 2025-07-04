import {
  TEST_ARRAY_STRING,
  TEST_DICT,
  TEST_DICT_STRING,
} from "../__fixtures__/test-data";
import { JsonKit } from "./JsonKit";
import { Primitive } from "./Primitive";

describe("JsonKit", () => {
  test("should create a primitive buffer from json data", () => {
    expect(JsonKit.buffer(TEST_DICT).toString("base64")).toMatchSnapshot();
  });

  test("should parse a primitive string (array) to json data", () => {
    expect(JsonKit.parse(TEST_ARRAY_STRING)).toMatchSnapshot();
  });

  test("should parse a primitive string (json) to json data", () => {
    expect(JsonKit.parse(TEST_DICT_STRING)).toMatchSnapshot();
  });

  test("should create a Primitive instance from json data", () => {
    expect(JsonKit.primitive(TEST_DICT)).toBeInstanceOf(Primitive);
  });

  test("should create a primitive string from json data", () => {
    expect(JsonKit.stringify(TEST_DICT)).toMatchSnapshot();
  });
});
