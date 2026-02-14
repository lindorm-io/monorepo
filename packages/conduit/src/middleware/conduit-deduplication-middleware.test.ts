import { ConduitMiddleware } from "../types";
import { createConduitDeduplicationMiddleware } from "./conduit-deduplication-middleware";

describe("conduitDeduplicationMiddleware", () => {
  let ctx: any;
  let next: jest.Mock;
  let middleware: ConduitMiddleware;

  beforeEach(() => {
    ctx = {
      req: {
        url: "https://api.test/resource",
        query: { param: "value" },
        config: {
          method: "GET",
        },
      },
      res: {
        data: { result: "data" },
        status: 200,
        statusText: "OK",
        headers: {},
      },
    };

    next = jest.fn().mockResolvedValue(undefined);
    middleware = createConduitDeduplicationMiddleware();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("concurrent identical GET requests only call next() once", async () => {
    const ctx1: any = {
      req: {
        url: "https://api.test/resource",
        query: { param: "value" },
        config: { method: "GET" },
      },
      res: {} as any,
    };

    const ctx2: any = {
      req: {
        url: "https://api.test/resource",
        query: { param: "value" },
        config: { method: "GET" },
      },
      res: {} as any,
    };

    // Set up next to simulate async work
    next.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      ctx1.res = { data: "shared-result", status: 200, statusText: "OK", headers: {} };
      ctx2.res = { data: "shared-result", status: 200, statusText: "OK", headers: {} };
    });

    // Fire both requests concurrently
    const [result1, result2] = await Promise.all([
      middleware(ctx1, next),
      middleware(ctx2, next),
    ]);

    // Should only call next once
    expect(next).toHaveBeenCalledTimes(1);

    // Both contexts should have the response
    expect(ctx1.res.data).toBe("shared-result");
    expect(ctx2.res.data).toBe("shared-result");
  });

  test("non-GET requests are not deduplicated", async () => {
    const ctx1: any = {
      req: {
        url: "https://api.test/resource",
        query: {},
        config: { method: "POST" },
      },
      res: {} as any,
    };

    const ctx2: any = {
      req: {
        url: "https://api.test/resource",
        query: {},
        config: { method: "POST" },
      },
      res: {} as any,
    };

    next.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await Promise.all([middleware(ctx1, next), middleware(ctx2, next)]);

    // Both should call next
    expect(next).toHaveBeenCalledTimes(2);
  });

  test("HEAD requests are deduplicated", async () => {
    const ctx1: any = {
      req: {
        url: "https://api.test/resource",
        query: {},
        config: { method: "HEAD" },
      },
      res: {} as any,
    };

    const ctx2: any = {
      req: {
        url: "https://api.test/resource",
        query: {},
        config: { method: "HEAD" },
      },
      res: {} as any,
    };

    next.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      ctx1.res = { data: null, status: 200, statusText: "OK", headers: {} };
      ctx2.res = { data: null, status: 200, statusText: "OK", headers: {} };
    });

    await Promise.all([middleware(ctx1, next), middleware(ctx2, next)]);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("different query parameters result in different keys", async () => {
    const ctx1: any = {
      req: {
        url: "https://api.test/resource",
        query: { param: "value1" },
        config: { method: "GET" },
      },
      res: {} as any,
    };

    const ctx2: any = {
      req: {
        url: "https://api.test/resource",
        query: { param: "value2" },
        config: { method: "GET" },
      },
      res: {} as any,
    };

    next.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await Promise.all([middleware(ctx1, next), middleware(ctx2, next)]);

    // Different queries should not be deduplicated
    expect(next).toHaveBeenCalledTimes(2);
  });

  test("different URLs result in different keys", async () => {
    const ctx1: any = {
      req: {
        url: "https://api.test/resource1",
        query: {},
        config: { method: "GET" },
      },
      res: {} as any,
    };

    const ctx2: any = {
      req: {
        url: "https://api.test/resource2",
        query: {},
        config: { method: "GET" },
      },
      res: {} as any,
    };

    next.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await Promise.all([middleware(ctx1, next), middleware(ctx2, next)]);

    // Different URLs should not be deduplicated
    expect(next).toHaveBeenCalledTimes(2);
  });

  test("sequential requests are not deduplicated", async () => {
    await middleware(ctx, next);
    await middleware(ctx, next);

    // Sequential requests should both call next
    expect(next).toHaveBeenCalledTimes(2);
  });

  test("propagates errors to all waiting requests", async () => {
    const error = new Error("Request failed");
    const ctx1: any = {
      req: {
        url: "https://api.test/resource",
        query: {},
        config: { method: "GET" },
      },
      res: {} as any,
    };

    const ctx2: any = {
      req: {
        url: "https://api.test/resource",
        query: {},
        config: { method: "GET" },
      },
      res: {} as any,
    };

    next.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      throw error;
    });

    const [result1, result2] = await Promise.allSettled([
      middleware(ctx1, next),
      middleware(ctx2, next),
    ]);

    // Both should reject with the same error
    expect(result1.status).toBe("rejected");
    expect(result2.status).toBe("rejected");
    expect((result1 as PromiseRejectedResult).reason).toBe(error);
    expect((result2 as PromiseRejectedResult).reason).toBe(error);

    // Next should only be called once
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("cleans up inflight entry after completion", async () => {
    const ctx1: any = {
      req: {
        url: "https://api.test/resource",
        query: {},
        config: { method: "GET" },
      },
      res: {} as any,
    };

    const ctx2: any = {
      req: {
        url: "https://api.test/resource",
        query: {},
        config: { method: "GET" },
      },
      res: {} as any,
    };

    next.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      ctx1.res = { data: "result", status: 200, statusText: "OK", headers: {} };
      ctx2.res = { data: "result", status: 200, statusText: "OK", headers: {} };
    });

    // First batch
    await Promise.all([middleware(ctx1, next), middleware(ctx2, next)]);
    expect(next).toHaveBeenCalledTimes(1);

    // Second batch (should not reuse, should call next again)
    await Promise.all([middleware(ctx1, next), middleware(ctx2, next)]);
    expect(next).toHaveBeenCalledTimes(2);
  });

  test("cleans up inflight entry after error", async () => {
    const ctx1: any = {
      req: {
        url: "https://api.test/resource",
        query: {},
        config: { method: "GET" },
      },
      res: {} as any,
    };

    const ctx2: any = {
      req: {
        url: "https://api.test/resource",
        query: {},
        config: { method: "GET" },
      },
      res: {} as any,
    };

    next.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      throw new Error("fail");
    });

    // First batch fails
    await Promise.allSettled([middleware(ctx1, next), middleware(ctx2, next)]);
    expect(next).toHaveBeenCalledTimes(1);

    // Second batch should retry (not blocked by previous error)
    await Promise.allSettled([middleware(ctx1, next), middleware(ctx2, next)]);
    expect(next).toHaveBeenCalledTimes(2);
  });
});
