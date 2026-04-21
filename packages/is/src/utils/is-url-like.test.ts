import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isUrlLike } from "./is-url-like";
import { describe, expect, test } from "vitest";

describe("isUrlLike", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isUrlLike(value)).toMatchSnapshot();
  });
});
