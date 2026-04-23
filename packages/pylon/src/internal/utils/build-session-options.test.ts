import { describe, expect, test } from "vitest";
import {
  buildIrisSessionOptions,
  buildProteusSessionOptions,
} from "./build-session-options.js";

describe("buildProteusSessionOptions", () => {
  test("should forward logger, hook meta, and signal for an HTTP ctx", () => {
    const controller = new AbortController();
    const ctx: any = {
      logger: { label: "pylon" },
      request: {},
      signal: controller.signal,
      state: {
        metadata: {
          correlationId: "corr-abc",
          date: new Date("2025-01-01T00:00:00Z"),
        },
      },
    };

    const opts = buildProteusSessionOptions(ctx, "alice");

    expect(opts).toEqual({
      logger: ctx.logger,
      meta: {
        correlationId: "corr-abc",
        actor: "alice",
        timestamp: new Date("2025-01-01T00:00:00Z"),
      },
      signal: controller.signal,
    });
  });

  test("should pass signal undefined for a non-HTTP (socket) ctx", () => {
    const ctx: any = {
      logger: { label: "pylon" },
      event: "test:event",
    };

    const opts = buildProteusSessionOptions(ctx, "unknown");

    expect(opts.signal).toBeUndefined();
    expect(opts.meta).toEqual({
      correlationId: "unknown",
      actor: "unknown",
      timestamp: expect.any(Date),
    });
  });
});

describe("buildIrisSessionOptions", () => {
  test("should forward logger and hook meta, but NO signal key", () => {
    const controller = new AbortController();
    const ctx: any = {
      logger: { label: "pylon" },
      request: {},
      signal: controller.signal,
      state: {
        metadata: {
          correlationId: "corr-abc",
          date: new Date("2025-01-01T00:00:00Z"),
        },
      },
    };

    const opts = buildIrisSessionOptions(ctx, "alice");

    expect(opts).toEqual({
      logger: ctx.logger,
      meta: {
        correlationId: "corr-abc",
        actor: "alice",
        timestamp: new Date("2025-01-01T00:00:00Z"),
      },
    });
    expect(opts).not.toHaveProperty("signal");
  });
});
