import { TEST_ARRAY_WITH_OBJECTS, TEST_OBJECT } from "../../__fixtures__/objects";
import { INVALID_INPUT, TEST_STRINGS } from "../../__fixtures__/strings";
import { constantArray, constantCase, constantKeys } from "./constant";

describe("constantCase", () => {
  test.each(TEST_STRINGS)("should convert %s", (input) => {
    expect(constantCase(input)).toMatchSnapshot();
  });

  test("should convert object keys", () => {
    expect(constantKeys(TEST_OBJECT)).toMatchSnapshot();
  });

  test("should convert array with objects", () => {
    expect(constantKeys(TEST_ARRAY_WITH_OBJECTS)).toMatchSnapshot();
  });

  test("should convert array with strings", () => {
    expect(constantArray(TEST_STRINGS)).toMatchSnapshot();
  });

  test.each(INVALID_INPUT)("should throw for invalid input $type", ({ value }) => {
    expect(() => constantCase(value)).toThrow(Error);
  });
});
