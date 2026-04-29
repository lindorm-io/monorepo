import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isUrl } from "./is-url.js";
import { describe, expect, test } from "vitest";

describe("isUrl", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isUrl(value)).toMatchSnapshot();
  });
});
