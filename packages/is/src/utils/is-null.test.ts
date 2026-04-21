import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isNull } from "./is-null";
import { describe, expect, test } from "vitest";

describe("isNull", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isNull(value)).toMatchSnapshot();
  });
});
