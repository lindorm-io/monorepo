import { isTypewriterOutput } from "./is-typewriter-output.js";
import { describe, expect, test } from "vitest";

describe("isTypewriterOutput", () => {
  test.each(["typescript", "typescript-zod"])("should accept %s", (value) => {
    expect(isTypewriterOutput(value)).toBe(true);
  });

  test.each([
    "rust",
    "TypeScript",
    "typescript-rust",
    "typescript ",
    "",
    undefined,
    null,
    42,
    ["typescript"],
    { output: "typescript" },
  ])("should reject %s", (value) => {
    expect(isTypewriterOutput(value)).toBe(false);
  });
});
