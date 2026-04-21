import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isArray } from "./is-array.js";
import { describe, expect, test } from "vitest";

describe("isArray", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isArray(value)).toMatchSnapshot();
  });
});
