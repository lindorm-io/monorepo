import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isClass } from "./is-class.js";
import { describe, expect, test } from "vitest";

describe("isClass", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isClass(value)).toMatchSnapshot();
  });
});
