import MockDate from "mockdate";
import { ConduitError } from "../errors";
import { ConduitMiddleware } from "../types";
import { createConduitRateLimitMiddleware } from "./conduit-rate-limit-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("conduitRateLimitMiddleware", () => {
  let ctx: any;
  let next: jest.Mock;
  let middleware: ConduitMiddleware;

  beforeEach(() => {
    ctx = {
      req: {
        url: "https://api.test/resource",
      },
      app: {
        baseURL: null,
      },
    };

    next = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    MockDate.set(MockedDate);
  });

  test("allows requests under the limit", async () => {
    middleware = createConduitRateLimitMiddleware({ maxRequests: 5, windowMs: 1000 });

    await expect(middleware(ctx, next)).resolves.toBeUndefined();
    await expect(middleware(ctx, next)).resolves.toBeUndefined();
    await expect(middleware(ctx, next)).resolves.toBeUndefined();

    expect(next).toHaveBeenCalledTimes(3);
  });

  test("throws ConduitError with status 429 when limit exceeded", async () => {
    middleware = createConduitRateLimitMiddleware({ maxRequests: 2, windowMs: 10000 });

    await expect(middleware(ctx, next)).resolves.toBeUndefined();
    await expect(middleware(ctx, next)).resolves.toBeUndefined();

    await expect(middleware(ctx, next)).rejects.toThrow(
      expect.objectContaining({
        message: "Rate limit exceeded",
        status: 429,
      }),
    );

    expect(next).toHaveBeenCalledTimes(2);
  });

  test("tokens refill over time", async () => {
    middleware = createConduitRateLimitMiddleware({ maxRequests: 2, windowMs: 1000 });

    // Use both tokens
    await expect(middleware(ctx, next)).resolves.toBeUndefined();
    await expect(middleware(ctx, next)).resolves.toBeUndefined();

    // Advance time by 500ms (half of window) to refill 1 token
    MockDate.set(new Date(MockedDate.getTime() + 500));

    // Should have 1 token now
    await expect(middleware(ctx, next)).resolves.toBeUndefined();

    // Advance time by another 500ms to refill another token
    MockDate.set(new Date(MockedDate.getTime() + 1000));

    // Should have 1 more token
    await expect(middleware(ctx, next)).resolves.toBeUndefined();

    expect(next).toHaveBeenCalledTimes(4);
  });

  test("limits per origin by default", async () => {
    middleware = createConduitRateLimitMiddleware({ maxRequests: 1, windowMs: 1000 });

    const ctx1: any = {
      req: { url: "https://api1.test/resource" },
      app: { baseURL: null },
    };

    const ctx2: any = {
      req: { url: "https://api2.test/resource" },
      app: { baseURL: null },
    };

    // Each origin has its own bucket
    await expect(middleware(ctx1, next)).resolves.toBeUndefined();
    await expect(middleware(ctx2, next)).resolves.toBeUndefined();

    // Both origins exhausted
    await expect(middleware(ctx1, next)).rejects.toThrow("Rate limit exceeded");
    await expect(middleware(ctx2, next)).rejects.toThrow("Rate limit exceeded");

    expect(next).toHaveBeenCalledTimes(2);
  });

  test("uses global bucket when perOrigin is false", async () => {
    middleware = createConduitRateLimitMiddleware({
      maxRequests: 1,
      windowMs: 1000,
      perOrigin: false,
    });

    const ctx1: any = {
      req: { url: "https://api1.test/resource" },
      app: { baseURL: null },
    };

    const ctx2: any = {
      req: { url: "https://api2.test/resource" },
      app: { baseURL: null },
    };

    // First request uses the global token
    await expect(middleware(ctx1, next)).resolves.toBeUndefined();

    // Second request from different origin fails (same bucket)
    await expect(middleware(ctx2, next)).rejects.toThrow("Rate limit exceeded");

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("handles relative URLs gracefully", async () => {
    middleware = createConduitRateLimitMiddleware({ maxRequests: 2 });

    ctx.req.url = "/api/resource";

    await expect(middleware(ctx, next)).resolves.toBeUndefined();
    await expect(middleware(ctx, next)).resolves.toBeUndefined();

    await expect(middleware(ctx, next)).rejects.toThrow("Rate limit exceeded");

    expect(next).toHaveBeenCalledTimes(2);
  });

  test("uses default config values", async () => {
    middleware = createConduitRateLimitMiddleware();

    // Default is 100 requests per 60000ms
    for (let i = 0; i < 100; i++) {
      await expect(middleware(ctx, next)).resolves.toBeUndefined();
    }

    await expect(middleware(ctx, next)).rejects.toThrow("Rate limit exceeded");

    expect(next).toHaveBeenCalledTimes(100);
  });
});
