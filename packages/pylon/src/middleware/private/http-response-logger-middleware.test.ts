import { createMockLogger } from "@lindorm/logger";
import { httpResponseLoggerMiddleware } from "./http-response-logger-middleware";

describe("httpResponseLoggerMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      metadata: "metadata",
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
    };
  });

  test("should log response information", async () => {
    await expect(httpResponseLoggerMiddleware(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.logger.info).toHaveBeenCalledWith("Service response", {
      metadata: "metadata",
      request: {
        body: "request.body",
        files: undefined,
        header: "request.header",
        method: "request.method",
        params: undefined,
        query: undefined,
        url: "request.url",
      },
      response: {
        body: "response.body",
        header: "response.header",
        message: "response.message",
        status: "response.status",
      },
    });
  });
});
