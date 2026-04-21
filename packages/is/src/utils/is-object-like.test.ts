import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isObjectLike } from "./is-object-like.js";
import { describe, expect, test } from "vitest";

describe("isObjectLike", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isObjectLike(value)).toMatchSnapshot();
  });
});
