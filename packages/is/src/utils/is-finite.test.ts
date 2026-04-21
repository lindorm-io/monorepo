import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isFinite } from "./is-finite";
import { describe, expect, test } from "vitest";

describe("isFinite", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isFinite(value)).toMatchSnapshot();
  });
});
