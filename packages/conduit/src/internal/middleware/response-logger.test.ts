import { ClientError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test } from "vitest";
import {
  TEST_BASIC_CREDENTIAL,
  TEST_JWT,
  TEST_JWT_SIGNATURE,
  TEST_OPAQUE_TOKEN,
  TEST_PASSWORD,
} from "../../__fixtures__/tokens.js";
import { responseLogger } from "./response-logger.js";

describe("responseLogger", () => {
  let ctx: any;
  let logger: any;

  beforeEach(() => {
    logger = createMockLogger();

    ctx = {
      app: { alias: "test", baseURL: "https://api.test.lindorm.io", environment: "test" },
      logger,
      req: {
        body: undefined,
        config: { method: "POST" },
        form: undefined,
        headers: { "Content-Type": "application/json" },
        metadata: { correlationId: "corr_01HZ", requestId: "req_01HZ", sessionId: null },
        origin: "https://api.test.lindorm.io",
        params: {},
        query: {},
        retryConfig: { maxAttempts: 3 },
        stream: undefined,
        url: "https://api.test.lindorm.io/oauth/token",
      },
      res: {
        cached: null,
        data: { ok: true },
        headers: { "Content-Type": "application/json" },
        status: 200,
        statusText: "OK",
      },
    };
  });

  const next = async () => {};

  describe("success", () => {
    test("should log a request without auth unchanged", async () => {
      await responseLogger(ctx, next);

      expect(logger.verbose).toHaveBeenCalledTimes(1);
      expect(logger.verbose.mock.calls[0][1]).toMatchObject({
        request: { headers: { "Content-Type": "application/json" } },
        response: { data: { ok: true }, status: 200 },
      });
    });

    test("should redact request auth headers", async () => {
      ctx.req.headers.Authorization = `Bearer ${TEST_JWT}`;

      await responseLogger(ctx, next);

      const [, payload] = logger.verbose.mock.calls[0];

      expect(payload.request.headers).toMatchSnapshot();
      expect(JSON.stringify(payload)).not.toContain(TEST_JWT_SIGNATURE);
    });

    test("should redact token fields of the response data", async () => {
      ctx.res.data = {
        access_token: TEST_JWT,
        refresh_token: TEST_OPAQUE_TOKEN,
        token_type: "Bearer",
        expires_in: 3600,
      };

      await responseLogger(ctx, next);

      const [, payload] = logger.verbose.mock.calls[0];

      expect(payload.response.data).toMatchSnapshot();
      expect(JSON.stringify(payload)).not.toContain(TEST_JWT_SIGNATURE);
      expect(JSON.stringify(payload)).not.toContain(TEST_OPAQUE_TOKEN);
    });

    test("should redact set-cookie response headers", async () => {
      ctx.res.headers = {
        "content-type": "application/json",
        "set-cookie": ["sid=abc123; Path=/; HttpOnly", "csrf=xyz789; Secure"],
      };

      await responseLogger(ctx, next);

      expect(logger.verbose.mock.calls[0][1].response.headers).toMatchSnapshot();
    });

    test("should not mutate the live request or response headers", async () => {
      ctx.req.headers.Authorization = `Basic ${TEST_BASIC_CREDENTIAL}`;

      await responseLogger(ctx, next);

      expect(ctx.req.headers.Authorization).toEqual(`Basic ${TEST_BASIC_CREDENTIAL}`);
    });
  });

  describe("failure", () => {
    const failing = async () => {
      throw new ClientError("Unauthorized", {
        code: "unauthorized",
        status: 401,
        debug: {
          transport: {
            config: { headers: { Authorization: "Bearer [Filtered]" } },
            response: { data: { error: "invalid_token" }, status: 401 },
          },
        },
      });
    };

    test("should redact request auth headers on the warn path", async () => {
      ctx.req.headers = {
        ...ctx.req.headers,
        Authorization: `Bearer ${TEST_JWT}`,
        DPoP: TEST_JWT,
      };
      ctx.req.body = { client_id: "client_01HZ", client_secret: TEST_PASSWORD };

      await expect(responseLogger(ctx, failing)).rejects.toThrow("Unauthorized");

      expect(logger.warn).toHaveBeenCalledTimes(1);

      const [, payload] = logger.warn.mock.calls[0];

      expect(payload.request.headers).toMatchSnapshot();
      expect(payload.request.body).toMatchSnapshot();
      expect(JSON.stringify(payload)).not.toContain(TEST_JWT_SIGNATURE);
      expect(JSON.stringify(payload)).not.toContain(TEST_PASSWORD);
    });

    test("should rethrow a non lindorm error without logging a payload", async () => {
      await expect(
        responseLogger(ctx, async () => {
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});
