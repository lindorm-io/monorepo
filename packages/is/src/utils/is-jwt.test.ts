import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isJwt } from "./is-jwt.js";
import { describe, expect, test } from "vitest";

describe("isJwt", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isJwt(value)).toMatchSnapshot();
  });
});
