import { TEST_ARRAY_WITH_OBJECTS, TEST_OBJECT } from "../../__fixtures__/objects";
import { INVALID_INPUT, TEST_STRINGS } from "../../__fixtures__/strings";
import { camelArray, camelCase, camelKeys } from "./camel";

describe("camelCase", () => {
  test.each(TEST_STRINGS)("should convert %s", (input) => {
    expect(camelCase(input)).toMatchSnapshot();
  });

  test("should convert object keys", () => {
    expect(camelKeys(TEST_OBJECT)).toMatchSnapshot();
  });

  test("should convert array with objects", () => {
    expect(camelKeys(TEST_ARRAY_WITH_OBJECTS)).toMatchSnapshot();
  });

  test("should convert array with strings", () => {
    expect(camelArray(TEST_STRINGS)).toMatchSnapshot();
  });

  test.each(INVALID_INPUT)("should throw for invalid input $type", ({ value }) => {
    expect(() => camelCase(value)).toThrow(Error);
  });
});
