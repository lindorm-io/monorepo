import { buildHookMeta } from "./build-hook-meta.js";
import { describe, expect, test } from "vitest";

describe("buildHookMeta", () => {
  test("should extract correlationId and date from ctx.state.metadata", () => {
    const date = new Date("2025-01-01T00:00:00Z");
    const ctx: any = {
      state: { metadata: { correlationId: "corr-123", date } },
    };

    const meta = buildHookMeta(ctx, "alice@test.com");

    expect(meta).toEqual({
      correlationId: "corr-123",
      actor: "alice@test.com",
      timestamp: date,
    });
  });

  test("should default correlationId to 'unknown' when metadata is missing", () => {
    const meta = buildHookMeta({}, "unknown");

    expect(meta.correlationId).toBe("unknown");
    expect(meta.actor).toBe("unknown");
    expect(meta.timestamp).toBeInstanceOf(Date);
  });

  test("should default correlationId when state exists but metadata does not", () => {
    const meta = buildHookMeta({ state: {} }, "unknown");

    expect(meta.correlationId).toBe("unknown");
  });

  test("should tolerate undefined ctx entirely", () => {
    const meta = buildHookMeta(undefined, "system");

    expect(meta.correlationId).toBe("unknown");
    expect(meta.actor).toBe("system");
    expect(meta.timestamp).toBeInstanceOf(Date);
  });

  test("should pass through 'unknown' actor", () => {
    const meta = buildHookMeta(
      { state: { metadata: { correlationId: "c" } } },
      "unknown",
    );

    expect(meta.actor).toBe("unknown");
  });
});
