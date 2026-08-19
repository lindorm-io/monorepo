import { describe, expect, test } from "vitest";
import { joinBlocks } from "./join-blocks.js";

describe("joinBlocks", () => {
  test("should join blocks with blank lines", () => {
    expect(joinBlocks(["a", "b", "c"])).toBe("a\n\nb\n\nc");
  });

  test("should drop empty blocks without leaving dangling blank lines", () => {
    expect(joinBlocks(["a", "", "b", ""])).toBe("a\n\nb");
  });
});
