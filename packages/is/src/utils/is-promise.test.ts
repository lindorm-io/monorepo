import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isPromise } from "./is-promise";
import { describe, expect, test } from "vitest";

describe("isPromise", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isPromise(value)).toMatchSnapshot();
  });
});
