import { ConduitContext } from "../../types";
import { composeAxiosData } from "./compose-axios-data";

describe("composeAxiosData", () => {
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

  test("should return form data with content-type header", async () => {
    const form = new FormData();
    form.append("test", "value");
    ctx.req.form = form;

    const result = await composeAxiosData(ctx);

    expect(result).toEqual({
      data: form,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
  });
});
