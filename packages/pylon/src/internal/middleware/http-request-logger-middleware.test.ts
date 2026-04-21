import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { httpRequestLoggerMiddleware } from "./http-request-logger-middleware";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("httpRequestLoggerMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      request: {
        body: "request.body",
        header: "request.header",
        method: "request.method",
        url: "request.url",
      },
      response: {
        body: "response.body",
        header: "response.header",
        message: "response.message",
        status: "response.status",
      },
      state: {
        metadata: "metadata",
      },
    };
  });

  test("should log request information", async () => {
    await expect(httpRequestLoggerMiddleware(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.logger.info).toHaveBeenCalledWith("Service request", {
      metadata: "metadata",
      request: {
        body: "request.body",
        header: "request.header",
        method: "request.method",
        query: undefined,
        url: "request.url",
      },
    });
  });
});
