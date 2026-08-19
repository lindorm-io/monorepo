import { describe, expect, test } from "vitest";
import { capture, errorShape } from "../../__fixtures__/test-helpers.js";
import { requireColumn } from "./require-column.js";

describe("requireColumn", () => {
  test("should return the location's column", () => {
    expect(requireColumn({ column: 5, line: 12 })).toBe(5);
  });

  test("should throw when the parser reports no column", () => {
    const error = capture(() => requireColumn({ line: 12 }));

    expect(error.code).toBe("model_invariant");
    expect(errorShape(error)).toMatchSnapshot();
  });
});
