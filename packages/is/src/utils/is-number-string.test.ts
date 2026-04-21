import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isNumberString } from "./is-number-string";
import { describe, expect, test } from "vitest";

describe("isNumberString", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isNumberString(value)).toMatchSnapshot();
  });
});
