import { describe, expect, test } from "vitest";
import { normalizeStepPatterns } from "./normalize-step-patterns.js";

describe("normalizeStepPatterns", () => {
  test("should prefix a relative pattern with a slash", () => {
    expect(normalizeStepPatterns(["src/**/*.steps.ts"])).toEqual(["/src/**/*.steps.ts"]);
  });

  test("should keep an already root-absolute pattern", () => {
    expect(normalizeStepPatterns(["/src/**/*.steps.ts"])).toEqual(["/src/**/*.steps.ts"]);
  });

  test("should normalize each pattern independently", () => {
    expect(normalizeStepPatterns(["a/*.steps.ts", "/b/*.steps.ts"])).toEqual([
      "/a/*.steps.ts",
      "/b/*.steps.ts",
    ]);
  });
});
