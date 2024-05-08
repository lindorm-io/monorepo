import { TEST_ARRAY_WITH_OBJECTS, TEST_OBJECT } from "../../__fixtures__/objects";
import { INVALID_INPUT, TEST_STRINGS } from "../../__fixtures__/strings";
import { pathArray, pathCase, pathKeys } from "./path";

describe("pathCase", () => {
  test.each(TEST_STRINGS)("should convert %s", (input) => {
    expect(pathCase(input)).toMatchSnapshot();
  });

  test("should convert object keys", () => {
    expect(pathKeys(TEST_OBJECT)).toMatchSnapshot();
  });

  test("should convert array with objects", () => {
    expect(pathKeys(TEST_ARRAY_WITH_OBJECTS)).toMatchSnapshot();
  });

  test("should convert array with strings", () => {
    expect(pathArray(TEST_STRINGS)).toMatchSnapshot();
  });

  test.each(INVALID_INPUT)("should throw for invalid input $type", ({ value }) => {
    expect(() => pathCase(value)).toThrow(Error);
  });
});
