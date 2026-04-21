import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isFinite } from "./is-finite.js";
import { describe, expect, test } from "vitest";

describe("isFinite", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isFinite(value)).toMatchSnapshot();
  });
});
