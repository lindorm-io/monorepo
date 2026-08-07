import { ClientError, ServerError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { createTestAppConfig } from "../../__fixtures__/app-config.js";
import { useRateLimit } from "./use-rate-limit.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

vi.mock("../../internal/utils/rate-limit/fixed-window-strategy.js");
vi.mock("../../internal/utils/rate-limit/sliding-window-strategy.js");
vi.mock("../../internal/utils/rate-limit/token-bucket-strategy.js");
vi.mock("../../internal/utils/is-context.js");

import { fixedWindowStrategy } from "../../internal/utils/rate-limit/fixed-window-strategy.js";
import { slidingWindowStrategy } from "../../internal/utils/rate-limit/sliding-window-strategy.js";
import { tokenBucketStrategy } from "../../internal/utils/rate-limit/token-bucket-strategy.js";
import { isHttpContext, isSocketContext } from "../../internal/utils/is-context.js";

describe("useRateLimit", () => {
  let ctx: any;
  let next: Mock;
  let mockSession: any;
  let mockRepository: any;

  const resetAt = new Date("2026-01-01T00:01:00.000Z");

  const allowedResult = { allowed: true, remaining: 9, resetAt };
  const deniedResult = { allowed: false, remaining: 0, resetAt };

  /** Rate limiting on for the deployment, with no window or ceiling of its own —
   *  every mount below states its own, exactly as a route-level mount does. */
  const RATE_LIMIT_ON = { strategy: "fixed", window: null, max: null } as const;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRepository = {};
    mockSession = { repository: vi.fn().mockReturnValue(mockRepository) };

    (fixedWindowStrategy as Mock).mockResolvedValue(allowedResult);
    (slidingWindowStrategy as Mock).mockResolvedValue(allowedResult);
    (tokenBucketStrategy as Mock).mockResolvedValue(allowedResult);

    (isHttpContext as unknown as Mock).mockReturnValue(true);
    (isSocketContext as unknown as Mock).mockReturnValue(false);

    ctx = {
      logger: createMockLogger(),
      state: { app: { config: createTestAppConfig({ rateLimit: RATE_LIMIT_ON }) } },
      request: { ip: "192.168.1.1" },
      set: vi.fn(),
      cache: mockSession,
    };
    next = vi.fn();
  });

  test("should call next when under rate limit (fixed strategy)", async () => {
    await useRateLimit({ window: "1m", max: 10 })(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(fixedWindowStrategy).toHaveBeenCalledWith(
      mockRepository,
      "192.168.1.1",
      60000,
      10,
    );
  });

  test("should throw 429 ClientError when rate limit exceeded", async () => {
    (fixedWindowStrategy as Mock).mockResolvedValue(deniedResult);

    try {
      await useRateLimit({ window: "1m", max: 10 })(ctx, next);
      expect.fail("Expected error to be thrown");
    } catch (err: any) {
      expect(err).toBeInstanceOf(ClientError);
      expect(err.status).toBe(429);
      expect(err.code).toBe("rate_limit_exceeded");
      expect(err.data).toEqual({
        limit: 10,
        remaining: 0,
        resetAt: deniedResult.resetAt.toISOString(),
        retryAfter: expect.any(Number),
        strategy: "fixed",
      });
    }

    expect(next).not.toHaveBeenCalled();
  });

  test("should set X-RateLimit headers on HTTP context", async () => {
    await useRateLimit({ window: "1m", max: 10 })(ctx, next);

    expect(ctx.set).toHaveBeenCalledWith("X-RateLimit-Limit", "10");
    expect(ctx.set).toHaveBeenCalledWith("X-RateLimit-Remaining", "9");
    expect(ctx.set).toHaveBeenCalledWith(
      "X-RateLimit-Reset",
      String(Math.ceil(resetAt.getTime() / 1000)),
    );
    expect(ctx.set).toHaveBeenCalledWith("X-RateLimit-Strategy", "fixed");
  });

  test("should NOT set headers on socket context", async () => {
    (isHttpContext as unknown as Mock).mockReturnValue(false);
    (isSocketContext as unknown as Mock).mockReturnValue(true);

    ctx = {
      logger: createMockLogger(),
      state: { app: { config: createTestAppConfig({ rateLimit: RATE_LIMIT_ON }) } },
      event: "test:event",
      io: { socket: { id: "socket-123" } },
      set: vi.fn(),
      cache: mockSession,
    };

    await useRateLimit({ window: "1m", max: 10 })(ctx, next);

    expect(ctx.set).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should use custom key function", async () => {
    const customKey = vi.fn().mockReturnValue("custom-key");

    await useRateLimit({ window: "1m", max: 10, key: customKey })(ctx, next);

    expect(customKey).toHaveBeenCalledWith(ctx);
    expect(fixedWindowStrategy).toHaveBeenCalledWith(
      mockRepository,
      "custom-key",
      60000,
      10,
    );
  });

  test("should skip when skip function returns true", async () => {
    const skip = vi.fn().mockReturnValue(true);

    await useRateLimit({ window: "1m", max: 10, skip })(ctx, next);

    expect(skip).toHaveBeenCalledWith(ctx);
    expect(fixedWindowStrategy).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should default to fixed strategy", async () => {
    await useRateLimit({ window: "1m", max: 10 })(ctx, next);

    expect(fixedWindowStrategy).toHaveBeenCalled();
    expect(slidingWindowStrategy).not.toHaveBeenCalled();
    expect(tokenBucketStrategy).not.toHaveBeenCalled();
  });

  test("should use sliding strategy when specified", async () => {
    await useRateLimit({ window: "1m", max: 10, strategy: "sliding" })(ctx, next);

    expect(slidingWindowStrategy).toHaveBeenCalledWith(
      mockRepository,
      "192.168.1.1",
      60000,
      10,
    );
    expect(fixedWindowStrategy).not.toHaveBeenCalled();
  });

  test("should use token-bucket strategy when specified", async () => {
    await useRateLimit({ window: "1m", max: 10, strategy: "token-bucket" })(ctx, next);

    expect(tokenBucketStrategy).toHaveBeenCalledWith(
      mockRepository,
      "192.168.1.1",
      60000,
      10,
    );
    expect(fixedWindowStrategy).not.toHaveBeenCalled();
  });

  test("should throw ServerError when no evictable session is on the context", async () => {
    delete ctx.cache;

    await expect(useRateLimit({ window: "1m", max: 10 })(ctx, next)).rejects.toThrow(
      ServerError,
    );
    expect(next).not.toHaveBeenCalled();
  });

  // ⚠ Same shape as useCache's: this throw sits BELOW the `rateLimit` config
  // guard, so the deployment already HAS a `rateLimit` block when it fires. What
  // is missing is the evictable source, and that is what the operator is told.
  test("should name the missing evictable source, not the policy block", async () => {
    delete ctx.cache;

    try {
      await useRateLimit({ window: "1m", max: 10 })(ctx, next);
      expect.unreachable("useRateLimit should have thrown");
    } catch (err: any) {
      expect(err.code).toBe("rate_limit_not_configured");
      expect(err.details).toContain("cache");
      expect(err.details).toContain("kv");
      expect(err.details).not.toContain("enabled");
      expect(err.details).toMatchSnapshot();
    }
  });

  test("should pass through silently (no throw) when rate limiting is disabled by config", async () => {
    ctx.state.app.config = createTestAppConfig({ rateLimit: false });
    delete ctx.cache; // disabled AND no session — must not throw

    await expect(
      useRateLimit({ window: "1m", max: 10 })(ctx, next),
    ).resolves.not.toThrow();

    expect(next).toHaveBeenCalledTimes(1);
    expect(fixedWindowStrategy).not.toHaveBeenCalled();
  });

  test("should default key to request.ip for HTTP", async () => {
    ctx.request.ip = "10.0.0.1";

    await useRateLimit({ window: "1m", max: 10 })(ctx, next);

    expect(fixedWindowStrategy).toHaveBeenCalledWith(
      mockRepository,
      "10.0.0.1",
      60000,
      10,
    );
  });

  test("should default key to socket.id for socket", async () => {
    (isHttpContext as unknown as Mock).mockReturnValue(false);
    (isSocketContext as unknown as Mock).mockReturnValue(true);

    ctx = {
      logger: createMockLogger(),
      state: { app: { config: createTestAppConfig({ rateLimit: RATE_LIMIT_ON }) } },
      event: "test:event",
      io: { socket: { id: "sock-abc" } },
      set: vi.fn(),
      cache: mockSession,
    };

    await useRateLimit({ window: "1m", max: 10 })(ctx, next);

    expect(fixedWindowStrategy).toHaveBeenCalledWith(
      mockRepository,
      "sock-abc",
      60000,
      10,
    );
  });

  test("should set Retry-After header on 429 for HTTP context", async () => {
    (fixedWindowStrategy as Mock).mockResolvedValue(deniedResult);

    try {
      await useRateLimit({ window: "1m", max: 10 })(ctx, next);
      expect.fail("Expected error to be thrown");
    } catch {
      // expected
    }

    expect(ctx.set).toHaveBeenCalledWith("Retry-After", expect.any(String));
  });

  test("should NOT set Retry-After header on 429 for socket context", async () => {
    (isHttpContext as unknown as Mock).mockReturnValue(false);
    (isSocketContext as unknown as Mock).mockReturnValue(true);
    (fixedWindowStrategy as Mock).mockResolvedValue(deniedResult);

    ctx = {
      logger: createMockLogger(),
      state: { app: { config: createTestAppConfig({ rateLimit: RATE_LIMIT_ON }) } },
      event: "test:event",
      io: { socket: { id: "socket-123" } },
      set: vi.fn(),
      cache: mockSession,
    };

    try {
      await useRateLimit({ window: "1m", max: 10 })(ctx, next);
      expect.fail("Expected error to be thrown");
    } catch {
      // expected
    }

    expect(ctx.set).not.toHaveBeenCalled();
  });

  // ⚠ The deployment's limits live on `ctx.state.app.config.rateLimit` and
  // NOWHERE else. The globally mounted `useRateLimit()` takes no arguments, so
  // there is no closure copy free to disagree with what every route-level mount
  // reads.
  describe("deployment policy", () => {
    const deployment = {
      strategy: "sliding",
      window: 30_000,
      max: 7,
    } as const;

    beforeEach(() => {
      ctx.state.app.config = createTestAppConfig({ rateLimit: deployment });
    });

    test("should adopt the deployment window, ceiling and strategy with no arguments", async () => {
      await useRateLimit()(ctx, next);

      expect(slidingWindowStrategy).toHaveBeenCalledWith(
        mockRepository,
        "192.168.1.1",
        30_000,
        7,
      );
      expect(ctx.set).toHaveBeenCalledWith("X-RateLimit-Limit", "7");
    });

    // A mount only ever NARROWS: what it states wins, member by member.
    test("should let a mount override the deployment window and ceiling", async () => {
      await useRateLimit({ window: "1m", max: 2 })(ctx, next);

      expect(slidingWindowStrategy).toHaveBeenCalledWith(
        mockRepository,
        "192.168.1.1",
        60_000,
        2,
      );
    });

    test("should let a mount override the deployment strategy", async () => {
      await useRateLimit({ strategy: "token-bucket" })(ctx, next);

      expect(tokenBucketStrategy).toHaveBeenCalledWith(
        mockRepository,
        "192.168.1.1",
        30_000,
        7,
      );
      expect(slidingWindowStrategy).not.toHaveBeenCalled();
    });

    // "Never rate-limit health checks" is stated ONCE, for the deployment, and
    // holds for a route-level mount that says nothing about it.
    test("should inherit the deployment skip on a mount that states none", async () => {
      const skip = vi.fn().mockReturnValue(true);
      ctx.state.app.config = createTestAppConfig({
        rateLimit: { ...deployment, skip },
      });

      await useRateLimit({ window: "1m", max: 2 })(ctx, next);

      expect(skip).toHaveBeenCalledWith(ctx);
      expect(slidingWindowStrategy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("should inherit the deployment key on a mount that states none", async () => {
      const key = vi.fn().mockReturnValue("deployment-key");
      ctx.state.app.config = createTestAppConfig({
        rateLimit: { ...deployment, key },
      });

      await useRateLimit()(ctx, next);

      expect(slidingWindowStrategy).toHaveBeenCalledWith(
        mockRepository,
        "deployment-key",
        30_000,
        7,
      );
    });

    // Enabled with no limits anywhere is not a silent no-op: the deployment
    // asked for rate limiting and never said how much.
    test("should throw when neither the mount nor the deployment bounds it", async () => {
      ctx.state.app.config = createTestAppConfig({ rateLimit: RATE_LIMIT_ON });

      await expect(useRateLimit()(ctx, next)).rejects.toMatchObject({
        code: "rate_limit_not_bounded",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("should still run when only the mount bounds it", async () => {
      ctx.state.app.config = createTestAppConfig({ rateLimit: RATE_LIMIT_ON });

      await expect(useRateLimit({ window: "1m", max: 4 })(ctx, next)).resolves.toBe(
        undefined,
      );
      expect(fixedWindowStrategy).toHaveBeenCalledWith(
        mockRepository,
        "192.168.1.1",
        60_000,
        4,
      );
    });
  });
});
