import { RequestContext } from "../../types";
import { composeFetchConfig } from "./compose-fetch-config";

describe("composeFetchConfig", () => {
  let ctx: any;

  beforeEach(() => {
    const req: RequestContext = {
      body: { body: "body" },
      config: {
        cache: "force-cache",
        credentials: "omit",
        integrity: "integrity",
        keepalive: true,
        method: "method",
        mode: "cors",
        priority: "auto",
        redirect: "error",
        referrer: "referrer",
        referrerPolicy: "no-referrer",
      },
      filename: undefined,
      form: undefined,
      headers: { header: "header" },
      metadata: {
        correlationId: "correlationId",
        requestId: "id",
        sessionId: "sessionId",
      },
      onDownloadProgress: undefined,
      onUploadProgress: undefined,
      params: {
        answer: "there",
        general: "kenobi",
      },
      query: {
        may: "the",
        force: "be",
        with: "you",
      },
      retryCallback: () => true,
      retryConfig: {
        maxAttempts: 3,
        strategy: "linear",
        timeout: 25,
        timeoutMax: 3000,
      },
      signal: undefined,
      stream: undefined,
      url: "https://lindorm.io:3000/test/path/hello/:answer/:general",
    };

    ctx = {
      app: { baseURL: undefined },
      req,
    };
  });

  test("should resolve", () => {
    expect(composeFetchConfig(ctx)).toEqual({
      input:
        "https://lindorm.io:3000/test/path/hello/there/kenobi?may=the&force=be&with=you",
      init: {
        body: '{"body":"body"}',
        headers: { "Content-Type": "application/json", header: "header" },
        cache: "force-cache",
        credentials: "omit",
        integrity: "integrity",
        keepalive: true,
        method: "method",
        mode: "cors",
        priority: "auto",
        redirect: "error",
        referrer: "referrer",
        referrerPolicy: "no-referrer",
      },
    });
  });

  test("should resolve with base url", () => {
    ctx.app.baseURL = "https://lindorm.io:5555";
    ctx.req.url = "/test/path/hello/:answer/:general";

    expect(composeFetchConfig(ctx)).toEqual({
      input:
        "https://lindorm.io:5555/test/path/hello/there/kenobi?may=the&force=be&with=you",
      init: {
        body: '{"body":"body"}',
        headers: { "Content-Type": "application/json", header: "header" },
        cache: "force-cache",
        credentials: "omit",
        integrity: "integrity",
        keepalive: true,
        method: "method",
        mode: "cors",
        priority: "auto",
        redirect: "error",
        referrer: "referrer",
        referrerPolicy: "no-referrer",
      },
    });
  });

  test("should resolve without host", () => {
    ctx.req.url = "/test/path/hello/:answer/:general";

    expect(composeFetchConfig(ctx)).toEqual({
      input: "/test/path/hello/there/kenobi?may=the&force=be&with=you",
      init: {
        body: '{"body":"body"}',
        headers: { "Content-Type": "application/json", header: "header" },
        cache: "force-cache",
        credentials: "omit",
        integrity: "integrity",
        keepalive: true,
        method: "method",
        mode: "cors",
        priority: "auto",
        redirect: "error",
        referrer: "referrer",
        referrerPolicy: "no-referrer",
      },
    });
  });

  test("should include AbortSignal when timeout is set", () => {
    ctx.req.config.timeout = 5000;

    const result = composeFetchConfig(ctx);

    expect(result.init.signal).toBeDefined();
    expect(result.init.signal).toBeInstanceOf(AbortSignal);
  });

  test("should include user-provided signal", () => {
    const controller = new AbortController();
    ctx.req.signal = controller.signal;

    const result = composeFetchConfig(ctx);

    expect(result.init.signal).toBe(controller.signal);
  });

  test("should combine timeout signal and user signal with AbortSignal.any", () => {
    const controller = new AbortController();
    ctx.req.config.timeout = 5000;
    ctx.req.signal = controller.signal;

    const result = composeFetchConfig(ctx);

    expect(result.init.signal).toBeDefined();
    expect(result.init.signal).toBeInstanceOf(AbortSignal);
    expect(result.init.signal).not.toBe(controller.signal);
  });

  test("should not include signal when no timeout or user signal", () => {
    const result = composeFetchConfig(ctx);

    expect(result.init.signal).toBeUndefined();
  });
});
