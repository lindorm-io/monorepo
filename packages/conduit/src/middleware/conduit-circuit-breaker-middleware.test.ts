import MockDate from "mockdate";
import { ConduitError } from "../errors";
import { ConduitCircuitBreakerCache, ConduitMiddleware } from "../types";
import { waitForProbe as _waitForProbe } from "../utils/private";
import { createConduitCircuitBreakerMiddleware } from "./conduit-circuit-breaker-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

jest.mock("../utils/private", () => ({
  waitForProbe: jest.fn(),
  defaultCircuitBreakerVerifier: jest.fn(),
}));

const waitForProbe = _waitForProbe as jest.Mock;

describe("conduitCircuitBreakerMiddleware", () => {
  let ctx: any;
  let next: jest.Mock;
  let cache: ConduitCircuitBreakerCache;
  let middleware: ConduitMiddleware;
  let verifier: jest.Mock;

  const origin = "https://api.test";
  const url = `${origin}/resource`;
  const error = new ConduitError("fail");

  beforeEach(() => {
    ctx = {
      req: { url },
      logger: { debug: jest.fn() },
    };

    cache = new Map();
    verifier = jest.fn().mockResolvedValue("closed");
    middleware = createConduitCircuitBreakerMiddleware(
      { expiration: 10, verifier },
      cache,
    );

    next = jest.fn().mockResolvedValue(undefined);
    waitForProbe.mockResolvedValue(undefined);
  });

  afterEach(jest.clearAllMocks);

  test("allows through when closed and next succeeds", async () => {
    await expect(middleware(ctx, next)).resolves.toBeUndefined();

    expect(next).toHaveBeenCalled();
  });

  test("opens circuit on first ConduitError and throws", async () => {
    verifier.mockResolvedValue("open");
    next.mockRejectedValue(error);

    await expect(middleware(ctx, next)).rejects.toThrow("fail");

    expect(verifier).toHaveBeenCalled();
  });

  test("blocks when state is open", async () => {
    cache.set(origin, {
      origin,
      state: "open",
      errors: [],
      timestamp: Date.now() - 1000,
      isProbing: false,
    });

    await expect(middleware(ctx, next)).rejects.toThrow("Circuit breaker is open");
  });

  test("half-opens after expiration and probes", async () => {
    cache.set(origin, {
      origin,
      state: "half-open",
      errors: [],
      timestamp: Date.now() - 20000,
      isProbing: false,
    });

    await expect(middleware(ctx, next)).resolves.toBeUndefined();

    expect(cache.has(origin)).toBe(false);
  });

  test("resets open after successful probe", async () => {
    cache.set(origin, {
      origin,
      state: "open",
      errors: [],
      timestamp: Date.now() - 20000,
      isProbing: false,
    });

    await expect(middleware(ctx, next)).resolves.toBeUndefined();

    expect(cache.has(origin)).toBe(false);
  });

  test("re-opens if error on half-open", async () => {
    cache.set(origin, {
      origin,
      state: "half-open",
      errors: [],
      timestamp: Date.now() - 20000,
      isProbing: false,
    });

    verifier.mockResolvedValue("open");
    next.mockRejectedValue(error);

    await expect(middleware(ctx, next)).rejects.toThrow("fail");
    const breaker = cache.get(origin)!;

    expect(breaker.state).toBe("open");
  });
});
