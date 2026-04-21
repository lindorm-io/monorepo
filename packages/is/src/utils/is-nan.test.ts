import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isNaN } from "./is-nan";
import { describe, expect, test } from "vitest";

describe("isNaN", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isNaN(value)).toMatchSnapshot();
  });
});
