import { createMockLogger } from "@lindorm-io/core-logger";
import { ClientError } from "@lindorm-io/errors";
import { createTestJwt } from "@lindorm-io/jwt";
import { Metric } from "@lindorm-io/koa";
import MockDate from "mockdate";
import { TokenValidationMiddlewareConfig } from "../types";
import { tokenValidationMiddleware, TokenValidationOptions } from "./token-validation-middleware";

MockDate.set("2021-01-01T08:00:00.000Z");

const next = () => Promise.resolve();

describe("tokenValidationMiddleware", () => {
  let config: TokenValidationMiddlewareConfig;
  let options: TokenValidationOptions;
  let path: string;
  let ctx: any;

  const logger = createMockLogger();

  beforeEach(() => {
    const jwt = createTestJwt();
    const { token } = jwt.sign({
      adjustedAccessLevel: 2,
      audiences: ["444a9836-d2c9-470e-9270-071bfcb61346"],
      expiry: "99 seconds",
      levelOfAssurance: 3,
      nonce: "6142a95bc7004df59e365e37516170a9",
      scopes: ["default", "openid", "email", "phone"],
      subject: "c57ed8ee-0797-44dd-921b-3db030879ec6",
      subjectHint: "identity",
      tenant: "e5abd790-3e7f-449e-934c-f5783c24ccd8",
      type: "type",
    });

    config = {
      audience: "444a9836-d2c9-470e-9270-071bfcb61346",
      clockTolerance: 50,
      issuer: "https://test.lindorm.io",
      subjectHints: ["identity"],
      tenant: "e5abd790-3e7f-449e-934c-f5783c24ccd8",
      contextKey: "tokenKey",
    };

    options = {
      adjustedAccessLevel: 2,
      levelOfAssurance: 3,
      maxAge: 300,
      scopes: ["default", "openid"],

      fromPath: {
        nonce: "request.body.nonce",
        subject: "request.body.subject",
      },
    };

    path = "request.body.tokenPath";

    ctx = {
      jwt,
      logger,
      metrics: {},
      request: {
        body: {
          nonce: "6142a95bc7004df59e365e37516170a9",
          subject: "c57ed8ee-0797-44dd-921b-3db030879ec6",
          tokenPath: token,
        },
      },
      token: {},
    };

    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should validate token on path with options", async () => {
    await expect(
      tokenValidationMiddleware(config)(path, options)(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.token.tokenKey).toStrictEqual(
      expect.objectContaining({
        subject: "c57ed8ee-0797-44dd-921b-3db030879ec6",
        token: expect.any(String),
      }),
    );
    expect(ctx.metrics.token).toStrictEqual(expect.any(Number));
  });

  test("should validate token on path custom validation callback", async () => {
    await expect(
      tokenValidationMiddleware(config)(path, {}, async (context, verifyData) => {
        if (verifyData.subject !== "c57ed8ee-0797-44dd-921b-3db030879ec6") {
          throw Error("message");
        }
      })(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.token.tokenKey).toBeTruthy();
  });

  test("should succeed when token on path is optional", async () => {
    options.optional = true;
    ctx.request.body.tokenPath = undefined;

    await expect(
      tokenValidationMiddleware(config)(path, options)(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.token.tokenKey).toBeUndefined();
  });

  test("should throw when token is not on path", async () => {
    ctx.request.body.tokenPath = undefined;

    await expect(tokenValidationMiddleware(config)(path)(ctx, next)).rejects.toThrow(ClientError);
  });

  test("should throw error with custom validation callback", async () => {
    await expect(
      tokenValidationMiddleware(config)(path, {}, async (context) => {
        if (context.token.tokenKey.subject === "c57ed8ee-0797-44dd-921b-3db030879ec6") {
          throw Error("message");
        }
      })(ctx, next),
    ).rejects.toThrow(ClientError);
  });
});
