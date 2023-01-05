import { composeContext } from "./compose-context";
import { createMockLogger } from "@lindorm-io/core-logger";

describe("composeContext", () => {
  let req: any;
  let logger: any;

  beforeEach(() => {
    req = {
      auth: { username: "username" },
      body: { body: "body" },
      config: { config: "config" },
      headers: { header: "header" },
      host: "host",
      method: "method",
      params: { param: "param" },
      path: "/test/path",
      port: 5000,
      protocol: "https",
      query: { query: "query" },
      retry: { retry: "retry" },
      retryCallback: "retryCallback",
      timeout: 250,
      withCredentials: true,
    };

    logger = createMockLogger();
  });

  test("should resolve", () => {
    expect(composeContext(req, logger)).toStrictEqual({
      req: {
        auth: {
          username: "username",
        },
        body: {
          body: "body",
        },
        config: {
          config: "config",
        },
        headers: {
          header: "header",
        },
        host: "host",
        method: "method",
        params: {
          param: "param",
        },
        path: "/test/path",
        port: 5000,
        protocol: "https",
        query: {
          query: "query",
        },
        retry: {
          retry: "retry",
        },
        retryCallback: "retryCallback",
        timeout: 250,
        withCredentials: true,
      },
      res: {
        config: {},
        data: {},
        headers: {},
        request: {},
        status: -1,
        statusText: "",
      },
      logger: expect.any(Object),
    });
  });
});
