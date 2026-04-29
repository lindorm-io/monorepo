import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isFunction } from "./is-function.js";
import { describe, expect, test } from "vitest";

describe("isFunction", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isFunction(value)).toMatchSnapshot();
  });
});
