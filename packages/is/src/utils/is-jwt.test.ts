import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isJwt } from "./is-jwt";
import { describe, expect, test } from "vitest";

describe("isJwt", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isJwt(value)).toMatchSnapshot();
  });
});
