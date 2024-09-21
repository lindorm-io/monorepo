import { TEST_DICT, TEST_STRING } from "../__fixtures__/test-data";
import { JsonKit } from "./JsonKit";

describe("JsonKit", () => {
  test("should create a primitive buffer from json data", () => {
    expect(JsonKit.buffer(TEST_DICT).toString("base64")).toMatchSnapshot();
  });

  test("should create a primitive string from json data", () => {
    expect(JsonKit.stringify(TEST_DICT)).toMatchSnapshot();
  });

  test("should parse a primitive string to json data", () => {
    expect(JsonKit.parse(TEST_STRING)).toMatchSnapshot();
  });
});
