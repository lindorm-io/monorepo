import { CircuitBreaker, CircuitOpenError, type ICircuitBreaker } from "@lindorm/breaker";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ConduitError } from "../errors";
import { createConduitCircuitBreakerMiddleware } from "./conduit-circuit-breaker-middleware";
import type { ConduitCircuitBreakerCache, ConduitMiddleware } from "../types";
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";

describe("conduitCircuitBreakerMiddleware", () => {
  let ctx: any;
  let next: Mock;
  let cache: ConduitCircuitBreakerCache;
  let middleware: ConduitMiddleware;
  const origin = "https://api.test";
  const url = `${origin}/resource`;

  beforeEach(() => {
    ctx = {
      req: { url, origin },
      logger: createMockLogger(),
    };

    cache = new Map();
    middleware = createConduitCircuitBreakerMiddleware({}, createMockLogger(), cache);
    next = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(vi.clearAllMocks);

  test("allows through when breaker is closed and next succeeds", async () => {
    await expect(middleware(ctx, next)).resolves.toBeUndefined();

    expect(next).toHaveBeenCalled();
  });

  test("creates a breaker per origin", async () => {
    await middleware(ctx, next);

    expect(cache.has(origin)).toBe(true);
    expect(cache.get(origin)!.name).toBe(`conduit:${origin}`);
  });

  test("reuses existing breaker for same origin", async () => {
    await middleware(ctx, next);

    const breaker = cache.get(origin);

    await middleware(ctx, next);

    expect(cache.get(origin)).toBe(breaker);
  });

  test("CircuitOpenError becomes ConduitError", async () => {
    const mockBreaker: ICircuitBreaker = {
      name: `conduit:${origin}`,
      state: "open",
      isOpen: true,
      isClosed: false,
      isHalfOpen: false,
      execute: vi.fn().mockRejectedValue(new CircuitOpenError("open")),
      open: vi.fn(),
      close: vi.fn(),
      reset: vi.fn(),
      on: vi.fn(),
    };
    cache.set(origin, mockBreaker);

    await expect(middleware(ctx, next)).rejects.toThrow(ConduitError);
    await expect(middleware(ctx, next)).rejects.toThrow("Circuit breaker is open");
  });

  test("non-ConduitError passes through unchanged", async () => {
    const regularError = new Error("Not a ConduitError");
    next.mockRejectedValue(regularError);

    await expect(middleware(ctx, next)).rejects.toThrow("Not a ConduitError");
    await expect(middleware(ctx, next)).rejects.toThrow(Error);
  });

  test("ConduitError server errors count toward threshold", async () => {
    middleware = createConduitCircuitBreakerMiddleware(
      { threshold: 2, window: 60000 },
      createMockLogger(),
      cache,
    );

    const serverError = new ConduitError("fail", { status: 500 });
    next.mockRejectedValue(serverError);

    // First failure
    await expect(middleware(ctx, next)).rejects.toThrow("fail");
    expect(cache.get(origin)!.state).toBe("closed");

    // Second failure should trip breaker
    await expect(middleware(ctx, next)).rejects.toThrow("fail");
    expect(cache.get(origin)!.state).toBe("open");
  });

  test("ConduitError client errors are ignorable", async () => {
    middleware = createConduitCircuitBreakerMiddleware(
      { threshold: 2, window: 60000 },
      createMockLogger(),
      cache,
    );

    const clientError = new ConduitError("not found", { status: 404 });
    next.mockRejectedValue(clientError);

    // Many client errors should not trip breaker
    for (let i = 0; i < 5; i++) {
      await expect(middleware(ctx, next)).rejects.toThrow("not found");
    }

    expect(cache.get(origin)!.state).toBe("closed");
  });

  test("per-origin isolation", async () => {
    middleware = createConduitCircuitBreakerMiddleware(
      { threshold: 1, window: 60000 },
      createMockLogger(),
      cache,
    );

    const serverError = new ConduitError("fail", { status: 500 });

    // Trip origin A
    const ctxA = {
      ...ctx,
      req: { url: "https://a.test/path", origin: "https://a.test" },
    };
    next.mockRejectedValue(serverError);
    await expect(middleware(ctxA, next)).rejects.toThrow("fail");

    expect(cache.get("https://a.test")!.state).toBe("open");

    // Origin B should still be closed
    const ctxB = {
      ...ctx,
      req: { url: "https://b.test/path", origin: "https://b.test" },
    };
    next.mockResolvedValue(undefined);
    await expect(middleware(ctxB, next)).resolves.toBeUndefined();

    expect(cache.get("https://b.test")!.state).toBe("closed");
  });

  test("handles relative URLs without crashing", async () => {
    ctx.req.url = "/api/test";
    ctx.app = { baseURL: "https://api.test" };

    await expect(middleware(ctx, next)).resolves.toBeUndefined();

    expect(next).toHaveBeenCalled();
  });

  test("handles relative URLs without baseURL fallback", async () => {
    ctx.req.url = "/api/test";
    ctx.app = undefined;

    await expect(middleware(ctx, next)).resolves.toBeUndefined();

    expect(next).toHaveBeenCalled();
  });
});
