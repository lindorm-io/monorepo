import { TEST_ARRAY_WITH_OBJECTS, TEST_OBJECT } from "../../__fixtures__/objects";
import { INVALID_INPUT, TEST_STRINGS } from "../../__fixtures__/strings";
import { kebabArray, kebabCase, kebabKeys } from "./kebab";

describe("kebabCase", () => {
  test.each(TEST_STRINGS)("should convert %s", (input) => {
    expect(kebabCase(input)).toMatchSnapshot();
  });

  test("should convert object keys", () => {
    expect(kebabKeys(TEST_OBJECT)).toMatchSnapshot();
  });

  test("should convert array with objects", () => {
    expect(kebabKeys(TEST_ARRAY_WITH_OBJECTS)).toMatchSnapshot();
  });

  test("should convert array with strings", () => {
    expect(kebabArray(TEST_STRINGS)).toMatchSnapshot();
  });

  test.each(INVALID_INPUT)("should throw for invalid input $type", ({ value }) => {
    expect(() => kebabCase(value)).toThrow(Error);
  });
});
