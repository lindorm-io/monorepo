import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isError } from "./is-error.js";
import { describe, expect, test } from "vitest";

describe("isError", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isError(value)).toMatchSnapshot();
  });
});
