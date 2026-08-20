import { describe, expect, test } from "vitest";
import { DocString } from "./DocString.js";

describe("DocString", () => {
  test("should expose content and mediaType", () => {
    const doc = new DocString({ content: '{"note":"hello"}', mediaType: "json" });

    expect(doc.content).toBe('{"note":"hello"}');
    expect(doc.mediaType).toBe("json");
  });

  test("should leave mediaType undefined when absent", () => {
    expect(new DocString({ content: "plain" }).mediaType).toBeUndefined();
  });

  test("should compare by content with ===, never the extends-String trap", () => {
    // quickpickle's `extends String` makes `doc === "expected"` silently
    // false while `==` works; a plain field cannot be misread that way.
    const doc = new DocString({ content: "expected" });

    expect(doc.content === "expected").toBe(true);
    expect(doc).not.toBeInstanceOf(String);
  });

  test("should carry hostile content verbatim", () => {
    const content = '`${payload}`; "; import { evil } from "x";\nnext   line';

    expect(new DocString({ content }).content).toBe(content);
  });
});
