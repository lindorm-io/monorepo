import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isPromise } from "./is-promise.js";
import { describe, expect, test } from "vitest";

describe("isPromise", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isPromise(value)).toMatchSnapshot();
  });
});
