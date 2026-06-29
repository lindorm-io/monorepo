import { EventEmitter } from "events";
import { createHttpAbortSignalMiddleware } from "./http-abort-signal-middleware.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("createHttpAbortSignalMiddleware", () => {
  let ctx: any;
  let req: EventEmitter;
  let res: EventEmitter & { writableEnded: boolean };

  beforeEach(() => {
    req = new EventEmitter();
    res = Object.assign(new EventEmitter(), { writableEnded: false });

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

  test("should abort with client-disconnect reason when the response closes before writableEnded", async () => {
    const middleware = createHttpAbortSignalMiddleware();

    await middleware(ctx as any, async () => {
      res.writableEnded = false;
      res.emit("close");

      expect(ctx.signal.aborted).toBe(true);
      expect(ctx.signal.reason).toEqual({
        kind: "client-disconnect",
        correlationId: "8b39eafc-7e31-501b-ab7b-58514b14856a",
        requestId: "aa9a627d-8296-598c-9589-4ec91d27d056",
      });
    });
  });

  test("should NOT abort when the response closes after writableEnded is true", async () => {
    const middleware = createHttpAbortSignalMiddleware();

    await middleware(ctx as any, async () => {
      res.writableEnded = true;
      res.emit("close");

      expect(ctx.signal.aborted).toBe(false);
    });
  });

  // Regression (F13): on a POST, the request stream emits "close" the moment the
  // body is fully consumed — before the handler writes a response. The signal
  // must NOT abort then, or in-flight work (e.g. DB queries) is cancelled.
  test("should NOT abort when the request stream closes (POST body read) before the response ends", async () => {
    const middleware = createHttpAbortSignalMiddleware();

    await middleware(ctx as any, async () => {
      res.writableEnded = false;
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

    expect(res.listenerCount("close")).toBe(0);

    await middleware(ctx as any, async () => {
      expect(res.listenerCount("close")).toBe(1);
    });

    expect(res.listenerCount("close")).toBe(0);
  });

  test("should remove the close listener even when next() throws", async () => {
    const middleware = createHttpAbortSignalMiddleware();

    const failingNext = vi.fn(async () => {
      throw new Error("boom");
    });

    await expect(middleware(ctx as any, failingNext)).rejects.toThrow("boom");
    expect(res.listenerCount("close")).toBe(0);
  });

  test("should not throw when ctx.state.metadata is missing", async () => {
    const middleware = createHttpAbortSignalMiddleware();

    ctx.state = undefined;

    await middleware(ctx as any, async () => {
      res.emit("close");

      expect(ctx.signal.aborted).toBe(true);
      expect(ctx.signal.reason).toEqual({
        kind: "client-disconnect",
        correlationId: undefined,
        requestId: undefined,
      });
    });
  });
});
