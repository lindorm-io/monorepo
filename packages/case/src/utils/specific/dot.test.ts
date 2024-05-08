import { TEST_ARRAY_WITH_OBJECTS, TEST_OBJECT } from "../../__fixtures__/objects";
import { INVALID_INPUT, TEST_STRINGS } from "../../__fixtures__/strings";
import { dotArray, dotCase, dotKeys } from "./dot";

describe("dotCase", () => {
  test.each(TEST_STRINGS)("should convert %s", (input) => {
    expect(dotCase(input)).toMatchSnapshot();
  });

  test("should convert object keys", () => {
    expect(dotKeys(TEST_OBJECT)).toMatchSnapshot();
  });

  test("should convert array with objects", () => {
    expect(dotKeys(TEST_ARRAY_WITH_OBJECTS)).toMatchSnapshot();
  });

  test("should convert array with strings", () => {
    expect(dotArray(TEST_STRINGS)).toMatchSnapshot();
  });

  test.each(INVALID_INPUT)("should throw for invalid input $type", ({ value }) => {
    expect(() => dotCase(value)).toThrow(Error);
  });
});
