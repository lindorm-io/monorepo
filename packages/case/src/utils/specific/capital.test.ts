import { TEST_ARRAY_WITH_OBJECTS, TEST_OBJECT } from "../../__fixtures__/objects";
import { INVALID_INPUT, TEST_STRINGS } from "../../__fixtures__/strings";
import { capitalArray, capitalCase, capitalKeys } from "./capital";

describe("capitalCase", () => {
  test.each(TEST_STRINGS)("should convert %s", (input) => {
    expect(capitalCase(input)).toMatchSnapshot();
  });

  test("should convert object keys", () => {
    expect(capitalKeys(TEST_OBJECT)).toMatchSnapshot();
  });

  test("should convert array with objects", () => {
    expect(capitalKeys(TEST_ARRAY_WITH_OBJECTS)).toMatchSnapshot();
  });

  test("should convert array with strings", () => {
    expect(capitalArray(TEST_STRINGS)).toMatchSnapshot();
  });

  test.each(INVALID_INPUT)("should throw for invalid input $type", ({ value }) => {
    expect(() => capitalCase(value)).toThrow(Error);
  });
});
