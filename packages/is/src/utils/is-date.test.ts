import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isDate } from "./is-date.js";
import { describe, expect, test } from "vitest";

describe("isDate", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isDate(value)).toMatchSnapshot();
  });
});
