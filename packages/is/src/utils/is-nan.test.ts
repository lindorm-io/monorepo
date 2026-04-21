import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isNaN } from "./is-nan.js";
import { describe, expect, test } from "vitest";

describe("isNaN", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isNaN(value)).toMatchSnapshot();
  });
});
