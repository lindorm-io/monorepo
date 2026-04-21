import { RetryStrategy } from "@lindorm/retry";
import { RequestContext } from "../../types";
import { composeAxiosConfig } from "./compose-axios-config";
import { beforeEach, describe, expect, test } from "vitest";

describe("composeAxiosConfig", () => {
  let ctx: any;

  beforeEach(() => {
    const req: RequestContext = {
      body: { body: "body" },
      config: {
        method: "GET",
        timeout: 250,
        withCredentials: true,
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
      onRetry: undefined,
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
      origin: "https://lindorm.io:3000",
      signal: undefined,
      stream: undefined,
      url: "https://lindorm.io:3000/test/path/hello/:answer/:general",
    };

    ctx = {
      app: { baseURL: undefined },
      req,
    };
  });

  test("should resolve", async () => {
    await expect(composeAxiosConfig(ctx)).resolves.toEqual({
      data: {
        body: "body",
      },
      headers: { "Content-Type": "application/json", header: "header" },
      method: "GET",
      timeout: 250,
      url: "https://lindorm.io:3000/test/path/hello/there/kenobi?may=the&force=be&with=you",
      withCredentials: true,
    });
  });

  test("should resolve with base url", async () => {
    ctx.app.baseURL = "https://lindorm.io:5555";
    ctx.req.url = "/test/path/hello/:answer/:general";

    await expect(composeAxiosConfig(ctx)).resolves.toEqual({
      data: {
        body: "body",
      },
      headers: { "Content-Type": "application/json", header: "header" },
      method: "GET",
      timeout: 250,
      url: "https://lindorm.io:5555/test/path/hello/there/kenobi?may=the&force=be&with=you",
      withCredentials: true,
    });
  });

  test("should resolve without host", async () => {
    ctx.req.url = "/test/path/hello/:answer/:general";

    await expect(composeAxiosConfig(ctx)).resolves.toEqual({
      data: {
        body: "body",
      },
      headers: { "Content-Type": "application/json", header: "header" },
      method: "GET",
      timeout: 250,
      url: "/test/path/hello/there/kenobi?may=the&force=be&with=you",
      withCredentials: true,
    });
  });

  test("should allow user headers to override computed Content-Type", async () => {
    ctx.req.headers = { "Content-Type": "application/xml" };

    await expect(composeAxiosConfig(ctx)).resolves.toEqual({
      data: {
        body: "body",
      },
      headers: { "Content-Type": "application/xml" },
      method: "GET",
      timeout: 250,
      url: "https://lindorm.io:3000/test/path/hello/there/kenobi?may=the&force=be&with=you",
      withCredentials: true,
    });
  });
});
