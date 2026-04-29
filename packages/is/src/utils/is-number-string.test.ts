import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isNumberString } from "./is-number-string.js";
import { describe, expect, test } from "vitest";

describe("isNumberString", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isNumberString(value)).toMatchSnapshot();
  });
});
