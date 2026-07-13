import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test } from "vitest";
import {
  TEST_BASIC_CREDENTIAL,
  TEST_JWT,
  TEST_JWT_SIGNATURE,
  TEST_PASSWORD,
} from "../../__fixtures__/tokens.js";
import { requestLogger } from "./request-logger.js";

describe("requestLogger", () => {
  let ctx: any;
  let logger: any;

  beforeEach(() => {
    logger = createMockLogger();

    ctx = {
      app: { alias: "test", baseURL: "https://api.test.lindorm.io", environment: "test" },
      logger,
      req: {
        body: undefined,
        config: { method: "GET" },
        form: undefined,
        headers: { "Content-Type": "application/json" },
        metadata: { correlationId: "corr_01HZ", requestId: "req_01HZ", sessionId: null },
        origin: "https://api.test.lindorm.io",
        params: {},
        query: {},
        retryConfig: { maxAttempts: 3 },
        stream: undefined,
        url: "https://api.test.lindorm.io/orders",
      },
    };
  });

  const next = async () => {};

  test("should log a request without auth unchanged", async () => {
    await expect(requestLogger(ctx, next)).resolves.toBeUndefined();

    expect(logger.verbose).toHaveBeenCalledTimes(1);
    expect(logger.verbose.mock.calls[0]).toMatchSnapshot();
  });

  test("should redact bearer, dpop and cookie headers", async () => {
    ctx.req.headers = {
      ...ctx.req.headers,
      Authorization: `DPoP ${TEST_JWT}`,
      Cookie: "sid=abc123",
      DPoP: TEST_JWT,
    };

    await requestLogger(ctx, next);

    const [, payload] = logger.verbose.mock.calls[0];

    expect(payload.request.headers).toMatchSnapshot();
    expect(JSON.stringify(payload)).not.toContain(TEST_JWT_SIGNATURE);
  });

  test("should redact the password of a basic auth header", async () => {
    ctx.req.headers.Authorization = `Basic ${TEST_BASIC_CREDENTIAL}`;

    await requestLogger(ctx, next);

    const [, payload] = logger.verbose.mock.calls[0];

    expect(payload.request.headers).toMatchSnapshot();
    expect(JSON.stringify(payload)).not.toContain(TEST_PASSWORD);
    expect(JSON.stringify(payload)).not.toContain(TEST_BASIC_CREDENTIAL);
  });

  test("should redact the client secret of a token request body", async () => {
    ctx.req.body = {
      client_id: "client_01HZ",
      client_secret: TEST_PASSWORD,
      grant_type: "client_credentials",
    };

    await requestLogger(ctx, next);

    const [, payload] = logger.verbose.mock.calls[0];

    expect(payload.request.body).toMatchSnapshot();
    expect(JSON.stringify(payload)).not.toContain(TEST_PASSWORD);
  });

  test("should not mutate the live request headers", async () => {
    ctx.req.headers.Authorization = `Bearer ${TEST_JWT}`;

    await requestLogger(ctx, next);

    expect(ctx.req.headers.Authorization).toEqual(`Bearer ${TEST_JWT}`);
  });
});
