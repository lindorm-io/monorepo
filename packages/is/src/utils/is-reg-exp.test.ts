import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isRegExp } from "./is-reg-exp.js";
import { describe, expect, test } from "vitest";

describe("isRegExp", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isRegExp(value)).toMatchSnapshot();
  });
});
