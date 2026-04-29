import { EventEmitter } from "events";
import { createHttpAbortSignalMiddleware } from "./http-abort-signal-middleware.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("createHttpAbortSignalMiddleware", () => {
  let ctx: any;
  let req: EventEmitter;
  let res: { writableEnded: boolean };

  beforeEach(() => {
    req = new EventEmitter();
    res = { writableEnded: false };

    ctx = {
      req,
      res,
      state: {
        metadata: {
          correlationId: "8b39eafc-7e31-501b-ab7b-58514b14856a",
          id: "aa9a627d-8296-598c-9589-4ec91d27d056",
        },
      },
    };
  });

  test("should assign an AbortSignal to ctx.signal at request start", async () => {
    const middleware = createHttpAbortSignalMiddleware();

    await middleware(ctx as any, async () => {
      expect(ctx.signal).toBeInstanceOf(AbortSignal);
      expect(ctx.signal.aborted).toBe(false);
    });
  });

  test("should abort with client-disconnect reason when close fires before writableEnded", async () => {
    const middleware = createHttpAbortSignalMiddleware();

    await middleware(ctx as any, async () => {
      res.writableEnded = false;
      req.emit("close");

      expect(ctx.signal.aborted).toBe(true);
      expect(ctx.signal.reason).toEqual({
        kind: "client-disconnect",
        correlationId: "8b39eafc-7e31-501b-ab7b-58514b14856a",
        requestId: "aa9a627d-8296-598c-9589-4ec91d27d056",
      });
    });
  });

  test("should NOT abort when close fires after writableEnded is true", async () => {
    const middleware = createHttpAbortSignalMiddleware();

    await middleware(ctx as any, async () => {
      res.writableEnded = true;
      req.emit("close");

      expect(ctx.signal.aborted).toBe(false);
    });
  });

  test("should NOT abort on normal completion (no close fired)", async () => {
    const middleware = createHttpAbortSignalMiddleware();

    await middleware(ctx as any, vi.fn());

    expect(ctx.signal.aborted).toBe(false);
  });

  test("should remove the close listener after next() resolves", async () => {
    const middleware = createHttpAbortSignalMiddleware();

    expect(req.listenerCount("close")).toBe(0);

    await middleware(ctx as any, async () => {
      expect(req.listenerCount("close")).toBe(1);
    });

    expect(req.listenerCount("close")).toBe(0);
  });

  test("should remove the close listener even when next() throws", async () => {
    const middleware = createHttpAbortSignalMiddleware();

    const failingNext = vi.fn(async () => {
      throw new Error("boom");
    });

    await expect(middleware(ctx as any, failingNext)).rejects.toThrow("boom");
    expect(req.listenerCount("close")).toBe(0);
  });

  test("should not throw when ctx.state.metadata is missing", async () => {
    const middleware = createHttpAbortSignalMiddleware();

    ctx.state = undefined;

    await middleware(ctx as any, async () => {
      req.emit("close");

      expect(ctx.signal.aborted).toBe(true);
      expect(ctx.signal.reason).toEqual({
        kind: "client-disconnect",
        correlationId: undefined,
        requestId: undefined,
      });
    });
  });
});
