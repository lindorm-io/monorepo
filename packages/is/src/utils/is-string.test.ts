import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isString } from "./is-string";
import { describe, expect, test } from "vitest";

describe("isString", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isString(value)).toMatchSnapshot();
  });
});
