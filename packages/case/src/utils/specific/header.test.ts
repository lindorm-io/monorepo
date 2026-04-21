import { TEST_ARRAY_WITH_OBJECTS, TEST_OBJECT } from "../../__fixtures__/objects.js";
import { INVALID_INPUT, TEST_STRINGS } from "../../__fixtures__/strings.js";
import { headerArray, headerCase, headerKeys } from "./header.js";
import { describe, expect, test } from "vitest";

describe("headerCase", () => {
  test.each(TEST_STRINGS)("should convert %s", (input) => {
    expect(headerCase(input)).toMatchSnapshot();
  });

  test("should convert object keys", () => {
    expect(headerKeys(TEST_OBJECT)).toMatchSnapshot();
  });

  test("should convert array with objects", () => {
    expect(headerKeys(TEST_ARRAY_WITH_OBJECTS)).toMatchSnapshot();
  });

  test("should convert array with strings", () => {
    expect(headerArray(TEST_STRINGS)).toMatchSnapshot();
  });

  test.each(INVALID_INPUT)("should throw for invalid input $type", ({ value }) => {
    expect(() => headerCase(value)).toThrow(Error);
  });
});
