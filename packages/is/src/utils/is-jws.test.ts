import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isJws } from "./is-jws.js";
import { describe, expect, test } from "vitest";

describe("isJws", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isJws(value)).toMatchSnapshot();
  });
});
