import { ConduitContext } from "../../types";
import { composeFetchData } from "./compose-fetch-data";

describe("composeFetchData", () => {
  let ctx: ConduitContext;

  beforeEach(() => {
    ctx = {
      app: {
        alias: null,
        baseURL: null,
        environment: null,
      },
      req: {
        body: undefined,
        config: {
          timeout: 1000,
          validateStatus: () => true,
        },
        filename: undefined,
        form: undefined,
        headers: {},
        metadata: {
          correlationId: "correlation-id",
          requestId: "request-id",
          sessionId: null,
        },
        params: {},
        query: {},
        retryCallback: () => true,
        retryConfig: {
          maxAttempts: 1,
          strategy: "linear",
          timeout: 100,
          timeoutMax: 1000,
        },
        stream: undefined,
        url: "/test",
      },
      res: {
        data: {},
        headers: {},
        status: -1,
        statusText: "",
      },
    } as any;
  });

  test("should return undefined body when no body or form", () => {
    const result = composeFetchData(ctx);

    expect(result).toEqual({
      body: undefined,
      headers: {},
    });
  });

  test("should return JSON body with content-type header for object", () => {
    ctx.req.body = { key: "value" };

    const result = composeFetchData(ctx);

    expect(result).toEqual({
      body: JSON.stringify({ key: "value" }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  test("should return undefined body when body is empty object", () => {
    ctx.req.body = {};

    const result = composeFetchData(ctx);

    expect(result).toEqual({
      body: undefined,
      headers: {},
    });
  });

  test("should return URLSearchParams for form without files", () => {
    const form = new FormData();
    form.append("test", "value");
    form.append("another", "field");
    ctx.req.form = form;

    const result = composeFetchData(ctx);

    expect(result.body).toBe("test=value&another=field");
    expect(result.headers).toEqual({
      "Content-Type": "application/x-www-form-urlencoded",
    });
  });

  test("should return FormData with files and empty headers", () => {
    const form = new FormData();
    const file = new File(["content"], "test.txt", { type: "text/plain" });
    form.append("file", file);
    form.append("field", "value");
    ctx.req.form = form;

    const result = composeFetchData(ctx);

    expect(result).toEqual({
      body: form,
      headers: {},
    });
  });

  test("should handle string body without JSON serialization", () => {
    ctx.req.body = "plain text" as any;

    const result = composeFetchData(ctx);

    expect(result).toEqual({
      body: "plain text",
      headers: {},
    });
  });

  test("should handle number body as string", () => {
    ctx.req.body = 42 as any;

    const result = composeFetchData(ctx);

    expect(result).toEqual({
      body: "42",
      headers: {},
    });
  });

  test("should handle boolean body as string", () => {
    ctx.req.body = false as any;

    const result = composeFetchData(ctx);

    expect(result).toEqual({
      body: "false",
      headers: {},
    });
  });

  test("should handle array body with JSON serialization", () => {
    ctx.req.body = [1, 2, 3] as any;

    const result = composeFetchData(ctx);

    expect(result).toEqual({
      body: JSON.stringify([1, 2, 3]),
      headers: {
        "Content-Type": "application/json",
      },
    });
  });
});
