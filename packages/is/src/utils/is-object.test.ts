import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isObject } from "./is-object";
import { describe, expect, test } from "vitest";

describe("isObject", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isObject(value)).toMatchSnapshot();
  });
});
