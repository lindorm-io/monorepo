import { defaultHeaders } from "./default-headers.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("defaultHeaders", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      app: {},
      req: {
        headers: {},
        metadata: {
          correlationId: "cor_1",
          requestId: "req_1",
          sessionId: null,
        },
      },
    };
  });

  test("should derive the correlation and request headers from metadata", async () => {
    await defaultHeaders(ctx, vi.fn());

    expect(ctx.req.headers["X-Correlation-Id"]).toBe("cor_1");
    expect(ctx.req.headers["X-Request-Id"]).toBe("req_1");
  });

  test("should set a Date header", async () => {
    await defaultHeaders(ctx, vi.fn());

    expect(Date.parse(ctx.req.headers["Date"])).not.toBeNaN();
  });

  test("should emit the session header when metadata carries a session", async () => {
    ctx.req.metadata.sessionId = "ses_1";

    await defaultHeaders(ctx, vi.fn());

    expect(ctx.req.headers["X-Session-Id"]).toBe("ses_1");
  });

  // A null session is the default. Emitting the header regardless would send an
  // empty value upstream on every request that has no session.
  test("should omit the session header when there is no session", async () => {
    await defaultHeaders(ctx, vi.fn());

    expect(ctx.req.headers).not.toHaveProperty("X-Session-Id");
  });

  test("should emit the environment header only when the app declares one", async () => {
    await defaultHeaders(ctx, vi.fn());
    expect(ctx.req.headers).not.toHaveProperty("X-Environment");

    ctx.app.environment = "test";
    await defaultHeaders(ctx, vi.fn());
    expect(ctx.req.headers["X-Environment"]).toBe("test");
  });

  // The whole point of running last: metadata written by user middleware must
  // reach the wire. Reading it at call time rather than copying an earlier
  // value is what makes that work.
  test("should read metadata at call time, not construction time", async () => {
    ctx.req.metadata.correlationId = "cor_overwritten";

    await defaultHeaders(ctx, vi.fn());

    expect(ctx.req.headers["X-Correlation-Id"]).toBe("cor_overwritten");
  });

  test("should call next middleware", async () => {
    const next = vi.fn();

    await defaultHeaders(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
