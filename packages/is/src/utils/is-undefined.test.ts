import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isUndefined } from "./is-undefined.js";
import { describe, expect, test } from "vitest";

describe("isUndefined", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isUndefined(value)).toMatchSnapshot();
  });
});
