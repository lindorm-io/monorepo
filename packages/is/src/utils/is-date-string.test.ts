import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isDateString } from "./is-date-string.js";
import { describe, expect, test } from "vitest";

describe("isDateString", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isDateString(value)).toMatchSnapshot();
  });
});
