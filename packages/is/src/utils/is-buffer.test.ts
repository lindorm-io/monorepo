import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isBuffer } from "./is-buffer";
import { describe, expect, test } from "vitest";

describe("isBuffer", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isBuffer(value)).toMatchSnapshot();
  });
});
