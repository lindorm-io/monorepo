import { RetryStrategy } from "@lindorm/retry";
import { RequestContext } from "../../types";
import { _composeFetchConfig } from "./compose-fetch-config";

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
        date: new Date(),
        requestId: "id",
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
      url: "https://osprey.no:3000/test/path/hello/:answer/:general",
    };

    ctx = { req };
  });

  test("should resolve", () => {
    expect(_composeFetchConfig(ctx)).toEqual({
      input: expect.objectContaining({
        host: "osprey.no:3000",
        hostname: "osprey.no",
        href: "https://osprey.no:3000/test/path/hello/there/kenobi?may=the&force=be&with=you",
        origin: "https://osprey.no:3000",
        pathname: "/test/path/hello/there/kenobi",
        port: "3000",
        protocol: "https:",
        search: "?may=the&force=be&with=you",
      }),
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
