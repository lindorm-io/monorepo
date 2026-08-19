import { describe, expect, test } from "vitest";
import { MIN_EXTRACT_CHARS, assertPlausible } from "./assert-plausible.js";

const LINE = "The plausibility floor is what stops an empty extract passing.";

describe("assertPlausible", () => {
  test("should accept an extract above the floor", () => {
    expect(() =>
      assertPlausible("mini/section-1", `${LINE}\n${LINE}\n${LINE}`),
    ).not.toThrow();
  });

  test("should reject an extract with too few characters", () => {
    expect(() => assertPlausible("mini/section-1", "a\nb\nc")).toThrow(
      expect.objectContaining({ code: "extract_implausible" }),
    );
  });

  test("should reject an extract with too few non-blank lines", () => {
    expect(() =>
      assertPlausible("mini/section-1", "x".repeat(MIN_EXTRACT_CHARS)),
    ).toThrow(expect.objectContaining({ code: "extract_implausible" }));
  });

  test("should reject a heading with no body", () => {
    expect(() => assertPlausible("mini/section-4", "4.  Empty")).toThrow(
      expect.objectContaining({ code: "extract_implausible" }),
    );
  });
});
