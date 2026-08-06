import type { ConduitContext } from "../../types/index.js";
import { composeAxiosData } from "./compose-axios-data.js";
import { beforeEach, describe, expect, test } from "vitest";

describe("composeAxiosData", () => {
  let ctx: ConduitContext;

  beforeEach(() => {
    ctx = {
      app: {
        alias: null,
        baseUrl: null,
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

  test("should return undefined data when no body, form, or stream", async () => {
    const result = await composeAxiosData(ctx);

    expect(result).toEqual({
      data: undefined,
      headers: {},
    });
  });

  test("should return body data with content-type header", async () => {
    ctx.req.body = { key: "value" };

    const result = await composeAxiosData(ctx);

    expect(result).toEqual({
      data: { key: "value" },
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  test("should return undefined data when body is empty object", async () => {
    ctx.req.body = {};

    const result = await composeAxiosData(ctx);

    expect(result).toEqual({
      data: undefined,
      headers: {},
    });
  });

  test("should return a file-free form as urlencoded search params", async () => {
    const form = new FormData();
    form.append("grant_type", "client_credentials");
    form.append("resource", "https://identity.lindorm.io");
    ctx.req.form = form;

    const result = await composeAxiosData(ctx);

    expect(result.headers).toEqual({
      "Content-Type": "application/x-www-form-urlencoded",
    });
    expect(result.data).toBeInstanceOf(URLSearchParams);
    expect((result.data as URLSearchParams).toString()).toMatchSnapshot();
  });

  test("should preserve repeated keys when serialising a form", async () => {
    const form = new FormData();
    form.append("resource", "https://one.lindorm.io");
    form.append("resource", "https://two.lindorm.io");
    ctx.req.form = form;

    const result = await composeAxiosData(ctx);

    expect((result.data as URLSearchParams).toString()).toMatchSnapshot();
  });

  test("should return form data with files and empty headers", async () => {
    const form = new FormData();
    const file = new File(["content"], "test.txt", { type: "text/plain" });
    form.append("file", file);
    form.append("field", "value");
    ctx.req.form = form;

    const result = await composeAxiosData(ctx);

    expect(result).toEqual({
      data: form,
      headers: {},
    });
  });

  test("should serialise the body as urlencoded when contentType asks for it", async () => {
    ctx.req.body = { grant_type: "authorization_code", code: "code" };
    ctx.req.contentType = "application/x-www-form-urlencoded";

    const result = await composeAxiosData(ctx);

    expect(result.headers).toEqual({
      "Content-Type": "application/x-www-form-urlencoded",
    });
    expect(result.data).toBeInstanceOf(URLSearchParams);
    expect((result.data as URLSearchParams).toString()).toBe(
      "grant_type=authorization_code&code=code",
    );
  });

  test("should keep JSON when contentType is application/json", async () => {
    ctx.req.body = { key: "value" };
    ctx.req.contentType = "application/json";

    const result = await composeAxiosData(ctx);

    expect(result).toEqual({
      data: { key: "value" },
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  // `form` is the more specific option, so it wins outright — the body is not
  // merged in behind the caller's back.
  test("should prefer form over a urlencoded body", async () => {
    const form = new FormData();
    form.append("from", "form");
    ctx.req.form = form;
    ctx.req.body = { from: "body" };
    ctx.req.contentType = "application/x-www-form-urlencoded";

    const result = await composeAxiosData(ctx);

    expect((result.data as URLSearchParams).toString()).toBe("from=form");
  });

  test("should declare the contentType for an already-serialised body", async () => {
    ctx.req.body = "grant_type=authorization_code" as any;
    ctx.req.contentType = "application/x-www-form-urlencoded";

    const result = await composeAxiosData(ctx);

    expect(result).toEqual({
      data: "grant_type=authorization_code",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
  });

  test("should handle string body without JSON serialization", async () => {
    ctx.req.body = "plain text" as any;

    const result = await composeAxiosData(ctx);

    expect(result).toEqual({
      data: "plain text",
      headers: {},
    });
  });

  test("should handle number body without JSON serialization", async () => {
    ctx.req.body = 42 as any;

    const result = await composeAxiosData(ctx);

    expect(result).toEqual({
      data: 42,
      headers: {},
    });
  });

  test("should handle boolean body without JSON serialization", async () => {
    ctx.req.body = true as any;

    const result = await composeAxiosData(ctx);

    expect(result).toEqual({
      data: true,
      headers: {},
    });
  });
});
