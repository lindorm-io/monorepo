import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isBooleanString } from "./is-boolean-string.js";
import { describe, expect, test } from "vitest";

describe("isBooleanString", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isBooleanString(value)).toMatchSnapshot();
  });
});
