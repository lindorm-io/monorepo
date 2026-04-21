import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isWebToken } from "./is-web-token";
import { describe, expect, test } from "vitest";

describe("isWebToken", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isWebToken(value)).toMatchSnapshot();
  });
});
