import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isBigInt } from "./is-bigint";
import { describe, expect, test } from "vitest";

describe("isBigInt", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isBigInt(value)).toMatchSnapshot();
  });
});
