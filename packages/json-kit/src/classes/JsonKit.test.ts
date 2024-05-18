import { TEST_DICT, TEST_STRING } from "../__fixtures__/test-data";
import { JsonKit } from "./JsonKit";

describe("JsonKit", () => {
  test("should create a primitive string from json data", () => {
    expect(JsonKit.stringify(TEST_DICT)).toMatchSnapshot();
  });

  test("should parse a primitive string to json data", () => {
    expect(JsonKit.parse(TEST_STRING)).toMatchSnapshot();
  });
});
