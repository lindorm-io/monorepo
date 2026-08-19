import { describe, expect, test, vi } from "vitest";

describe("polyfill-symbol-metadata", () => {
  test("should define Symbol.metadata when absent", async () => {
    delete (Symbol as { metadata?: symbol }).metadata;

    vi.resetModules();
    await import("./polyfill-symbol-metadata.js");

    expect((Symbol as { metadata?: symbol }).metadata).toBe(
      Symbol.for("Symbol.metadata"),
    );
  });

  test("should leave an existing Symbol.metadata untouched", async () => {
    const sentinel = Symbol("sentinel");
    const original = (Symbol as { metadata?: symbol }).metadata;
    (Symbol as { metadata?: symbol }).metadata = sentinel;

    vi.resetModules();
    await import("./polyfill-symbol-metadata.js");

    expect((Symbol as { metadata?: symbol }).metadata).toBe(sentinel);

    (Symbol as { metadata?: symbol }).metadata = original;
  });
});
