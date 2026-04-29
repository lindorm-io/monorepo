import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isNumber } from "./is-number.js";
import { describe, expect, test } from "vitest";

describe("isNumber", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isNumber(value)).toMatchSnapshot();
  });
});
