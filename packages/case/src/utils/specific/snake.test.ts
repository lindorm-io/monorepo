import { TEST_ARRAY_WITH_OBJECTS, TEST_OBJECT } from "../../__fixtures__/objects.js";
import { INVALID_INPUT, TEST_STRINGS } from "../../__fixtures__/strings.js";
import { snakeArray, snakeCase, snakeKeys } from "./snake.js";
import { describe, expect, test } from "vitest";

describe("snakeCase", () => {
  test.each(TEST_STRINGS)("should convert %s", (input) => {
    expect(snakeCase(input)).toMatchSnapshot();
  });

  test("should convert object keys", () => {
    expect(snakeKeys(TEST_OBJECT)).toMatchSnapshot();
  });

  test("should convert array with objects", () => {
    expect(snakeKeys(TEST_ARRAY_WITH_OBJECTS)).toMatchSnapshot();
  });

  test("should convert array with strings", () => {
    expect(snakeArray(TEST_STRINGS)).toMatchSnapshot();
  });

  test.each(INVALID_INPUT)("should throw for invalid input $type", ({ value }) => {
    expect(() => snakeCase(value)).toThrow(Error);
  });
});
