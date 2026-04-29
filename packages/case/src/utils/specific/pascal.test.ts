import { TEST_ARRAY_WITH_OBJECTS, TEST_OBJECT } from "../../__fixtures__/objects.js";
import { INVALID_INPUT, TEST_STRINGS } from "../../__fixtures__/strings.js";
import { pascalArray, pascalCase, pascalKeys } from "./pascal.js";
import { describe, expect, test } from "vitest";

describe("pascalCase", () => {
  test.each(TEST_STRINGS)("should convert %s", (input) => {
    expect(pascalCase(input)).toMatchSnapshot();
  });

  test("should convert object keys", () => {
    expect(pascalKeys(TEST_OBJECT)).toMatchSnapshot();
  });

  test("should convert array with objects", () => {
    expect(pascalKeys(TEST_ARRAY_WITH_OBJECTS)).toMatchSnapshot();
  });

  test("should convert array with strings", () => {
    expect(pascalArray(TEST_STRINGS)).toMatchSnapshot();
  });

  test.each(INVALID_INPUT)("should throw for invalid input $type", ({ value }) => {
    expect(() => pascalCase(value)).toThrow(Error);
  });
});
