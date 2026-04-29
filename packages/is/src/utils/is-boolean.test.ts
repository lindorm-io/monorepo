import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isBoolean } from "./is-boolean.js";
import { describe, expect, test } from "vitest";

describe("isBoolean", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isBoolean(value)).toMatchSnapshot();
  });
});
