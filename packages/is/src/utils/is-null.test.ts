import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isNull } from "./is-null.js";
import { describe, expect, test } from "vitest";

describe("isNull", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isNull(value)).toMatchSnapshot();
  });
});
