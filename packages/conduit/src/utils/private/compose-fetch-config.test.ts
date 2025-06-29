import { RetryStrategy } from "@lindorm/retry";
import { RequestContext } from "../../types";
import { composeFetchConfig } from "./compose-fetch-config";

describe("composeFetchConfig", () => {
  let ctx: any;

  beforeEach(() => {
    const req: RequestContext = {
      body: { body: "body" },
      config: {
        timeout: 250,
        withCredentials: true,
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
      params: {
        answer: "there",
        general: "kenobi",
      },
      query: {
        may: "the",
        force: "be",
        with: "you",
      },
      stream: undefined,
      retryCallback: () => true,
      retryConfig: {
        maxAttempts: 3,
        strategy: RetryStrategy.Linear,
        timeout: 25,
        timeoutMax: 3000,
      },
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
});
