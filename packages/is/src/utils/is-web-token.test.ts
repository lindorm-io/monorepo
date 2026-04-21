import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isWebToken } from "./is-web-token.js";
import { describe, expect, test } from "vitest";

describe("isWebToken", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isWebToken(value)).toMatchSnapshot();
  });
});
