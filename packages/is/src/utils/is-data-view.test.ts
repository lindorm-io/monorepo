import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isDataView } from "./is-data-view.js";
import { describe, expect, test } from "vitest";

describe("isDataView", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isDataView(value)).toMatchSnapshot();
  });

  test("should accept data views", () => {
    expect(isDataView(new DataView(new ArrayBuffer(8)))).toBe(true);
    expect(isDataView(new DataView(new ArrayBuffer(8), 4, 4))).toBe(true);
  });

  test("should reject anything else", () => {
    expect(isDataView(new ArrayBuffer(8))).toBe(false);
    expect(isDataView(new Uint8Array([1]))).toBe(false);
    expect(isDataView({})).toBe(false);
    expect(isDataView(null)).toBe(false);
  });
});
