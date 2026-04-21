import { ClientError, ServerError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { RATE_LIMIT_SOURCE } from "../../internal/constants/symbols.js";
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
  let mockSource: any;
  let mockRepository: any;

  const resetAt = new Date("2026-01-01T00:01:00.000Z");

  const allowedResult = { allowed: true, remaining: 9, resetAt };
  const deniedResult = { allowed: false, remaining: 0, resetAt };

  beforeEach(() => {
    vi.clearAllMocks();

    mockRepository = {};
    const sessionSource = { repository: vi.fn().mockReturnValue(mockRepository) };
    mockSource = { session: vi.fn().mockReturnValue(sessionSource) };

    (fixedWindowStrategy as Mock).mockResolvedValue(allowedResult);
    (slidingWindowStrategy as Mock).mockResolvedValue(allowedResult);
    (tokenBucketStrategy as Mock).mockResolvedValue(allowedResult);

    (isHttpContext as unknown as Mock).mockReturnValue(true);
    (isSocketContext as unknown as Mock).mockReturnValue(false);

    ctx = {
      logger: createMockLogger(),
      request: { ip: "192.168.1.1" },
      set: vi.fn(),
      [RATE_LIMIT_SOURCE]: mockSource,
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
      fail("Expected error to be thrown");
    } catch (err: any) {
      expect(err).toBeInstanceOf(ClientError);
      expect(err.status).toBe(429);
      expect(err.code).toBe("rate_limit_exceeded");
      expect(err.data).toEqual({
        limit: 10,
        remaining: 0,
        resetAt: deniedResult.resetAt.toISOString(),
        retryAfter: expect.any(Number),
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
      event: "test:event",
      io: { socket: { id: "socket-123" } },
      set: vi.fn(),
      [RATE_LIMIT_SOURCE]: mockSource,
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

  test("should throw ServerError when rate limit source is not configured", async () => {
    delete ctx[RATE_LIMIT_SOURCE];

    await expect(useRateLimit({ window: "1m", max: 10 })(ctx, next)).rejects.toThrow(
      ServerError,
    );
    expect(next).not.toHaveBeenCalled();
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
      event: "test:event",
      io: { socket: { id: "sock-abc" } },
      set: vi.fn(),
      [RATE_LIMIT_SOURCE]: mockSource,
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
      fail("Expected error to be thrown");
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
      event: "test:event",
      io: { socket: { id: "socket-123" } },
      set: vi.fn(),
      [RATE_LIMIT_SOURCE]: mockSource,
    };

    try {
      await useRateLimit({ window: "1m", max: 10 })(ctx, next);
      fail("Expected error to be thrown");
    } catch {
      // expected
    }

    expect(ctx.set).not.toHaveBeenCalled();
  });
});
