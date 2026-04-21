import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isObject } from "./is-object.js";
import { describe, expect, test } from "vitest";

describe("isObject", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isObject(value)).toMatchSnapshot();
  });
});
