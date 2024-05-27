import { createMockLogger } from "@lindorm/logger";
import { httpSessionLoggerMiddleware } from "./http-session-logger-middleware";

describe("httpSessionLoggerMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: "data",
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
      userAgent: {
        browser: "browser",
        geoIp: "geoIp",
        os: "os",
        platform: "platform",
        source: "source",
        version: "version",
      },
    };
  });

  test("should log session information", async () => {
    await expect(httpSessionLoggerMiddleware(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.logger.info).toHaveBeenCalledWith("Service request", {
      metadata: "metadata",
      request: {
        body: "request.body",
        data: "data",
        header: "request.header",
        method: "request.method",
        query: undefined,
        url: "request.url",
        userAgent: {
          browser: "browser",
          geoIp: "geoIp",
          os: "os",
          platform: "platform",
          source: "source",
          version: "version",
        },
      },
    });

    expect(ctx.logger.info).toHaveBeenCalledWith("Service response", {
      metadata: "metadata",
      request: {
        body: "request.body",
        data: "data",
        files: undefined,
        header: "request.header",
        method: "request.method",
        params: undefined,
        query: undefined,
        url: "request.url",
        userAgent: {
          browser: "browser",
          geoIp: "geoIp",
          os: "os",
          platform: "platform",
          source: "source",
          version: "version",
        },
      },
      response: {
        body: "response.body",
        headers: "response.header",
        message: "response.message",
        status: "response.status",
      },
      time: expect.any(Number),
    });
  });

  test("should log session error", async () => {
    const next = () => Promise.reject(new Error("error"));

    await expect(httpSessionLoggerMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.logger.error).toHaveBeenCalledWith(new Error("error"));
  });
});
