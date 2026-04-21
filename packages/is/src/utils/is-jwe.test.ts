import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isJwe } from "./is-jwe.js";
import { describe, expect, test } from "vitest";

describe("isJwe", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isJwe(value)).toMatchSnapshot();
  });
});
