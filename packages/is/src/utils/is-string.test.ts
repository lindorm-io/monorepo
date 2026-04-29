import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isString } from "./is-string.js";
import { describe, expect, test } from "vitest";

describe("isString", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isString(value)).toMatchSnapshot();
  });
});
