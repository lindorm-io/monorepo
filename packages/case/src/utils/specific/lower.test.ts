import { TEST_ARRAY_WITH_OBJECTS, TEST_OBJECT } from "../../__fixtures__/objects";
import { INVALID_INPUT, TEST_STRINGS } from "../../__fixtures__/strings";
import { lowerArray, lowerCase, lowerKeys } from "./lower";

describe("lowerCase", () => {
  test.each(TEST_STRINGS)("should convert %s", (input) => {
    expect(lowerCase(input)).toMatchSnapshot();
  });

  test("should convert object keys", () => {
    expect(lowerKeys(TEST_OBJECT)).toMatchSnapshot();
  });

  test("should convert array with objects", () => {
    expect(lowerKeys(TEST_ARRAY_WITH_OBJECTS)).toMatchSnapshot();
  });

  test("should convert array with strings", () => {
    expect(lowerArray(TEST_STRINGS)).toMatchSnapshot();
  });

  test.each(INVALID_INPUT)("should throw for invalid input $type", ({ value }) => {
    expect(() => lowerCase(value)).toThrow(Error);
  });
});
