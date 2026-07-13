import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { httpResponseLoggerMiddleware } from "./http-response-logger-middleware.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("httpResponseLoggerMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      request: {
        body: "request.body",
        header: {
          accept: "application/json",
          authorization: "Bearer header.payload.signature",
          cookie: "sid=session-value",
        },
        method: "request.method",
        url: "request.url",
      },
      response: {
        body: "response.body",
        header: {
          "content-type": "application/json",
          "set-cookie": ["sid=new-session-value; Path=/; HttpOnly"],
        },
        message: "response.message",
        status: "response.status",
      },
      state: {
        metadata: "metadata",
      },
    };
  });

  test("should log response information with redacted headers", async () => {
    await expect(httpResponseLoggerMiddleware(ctx, vi.fn())).resolves.toBeUndefined();

    const [, payload] = ctx.logger.info.mock.calls[0];

    expect(payload).toMatchSnapshot();
  });

  test("should redact the set-cookie response header", async () => {
    await httpResponseLoggerMiddleware(ctx, vi.fn());

    const logged = JSON.stringify(ctx.logger.info.mock.calls);

    expect(logged).not.toContain("new-session-value");
    expect(logged).not.toContain("session-value");
    expect(logged).not.toContain("signature");
  });

  test("should not mutate the live headers", async () => {
    await httpResponseLoggerMiddleware(ctx, vi.fn());

    expect(ctx.request.header.authorization).toBe("Bearer header.payload.signature");
    expect(ctx.response.header["set-cookie"]).toEqual([
      "sid=new-session-value; Path=/; HttpOnly",
    ]);
  });
});
