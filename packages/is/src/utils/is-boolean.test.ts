import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isBoolean } from "./is-boolean";
import { describe, expect, test } from "vitest";

describe("isBoolean", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isBoolean(value)).toMatchSnapshot();
  });
});
