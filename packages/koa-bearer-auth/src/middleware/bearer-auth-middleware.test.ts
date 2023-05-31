import { createMockLogger } from "@lindorm-io/core-logger";
import { ClientError } from "@lindorm-io/errors";
import { createTestJwt } from "@lindorm-io/jwt";
import { Metric } from "@lindorm-io/koa";
import MockDate from "mockdate";
import { BearerAuthMiddlewareConfig } from "../types";
import { bearerAuthMiddleware, BearerAuthOptions } from "./bearer-auth-middleware";

MockDate.set("2021-01-01T08:00:00.000Z");

const next = () => Promise.resolve();

describe("bearerAuthMiddleware", () => {
  let config: BearerAuthMiddlewareConfig;
  let options: BearerAuthOptions;
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
      type: "access_token",
    });

    config = {
      audience: "444a9836-d2c9-470e-9270-071bfcb61346",
      clockTolerance: 50,
      issuer: "https://test.lindorm.io",
      subjectHints: ["identity"],
      tenant: "e5abd790-3e7f-449e-934c-f5783c24ccd8",
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

    ctx = {
      jwt,
      logger,
      metrics: {},
      request: {
        body: {
          nonce: "6142a95bc7004df59e365e37516170a9",
          subject: "c57ed8ee-0797-44dd-921b-3db030879ec6",
        },
      },
      token: {},
    };

    ctx.getAuthorizationHeader = () => ({
      type: "Bearer",
      value: token,
    });
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should successfully validate bearer token auth with options", async () => {
    await expect(bearerAuthMiddleware(config)(options)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.token.bearerToken).toStrictEqual(
      expect.objectContaining({
        claims: expect.objectContaining({
          subject: "c57ed8ee-0797-44dd-921b-3db030879ec6",
        }),
        token: expect.any(String),
      }),
    );
    expect(ctx.metrics.auth).toStrictEqual(expect.any(Number));
  });

  test("should successfully validate bearer token with custom validation callback", async () => {
    await expect(
      bearerAuthMiddleware(config)({}, async (context, verifyData) => {
        if (verifyData.claims.subject !== "c57ed8ee-0797-44dd-921b-3db030879ec6") {
          throw Error("message");
        }
      })(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.token.bearerToken).toBeTruthy();
  });

  test("should throw error on missing Bearer Token Auth", async () => {
    ctx.getAuthorizationHeader = () => ({
      type: "Basic",
      value: "base64",
    });

    await expect(bearerAuthMiddleware(config)(options)(ctx, next)).rejects.toThrow(ClientError);
  });

  test("should throw error on erroneous token verification", async () => {
    ctx.getAuthorizationHeader = () => ({
      type: "Bearer",
      value: "jwt.jwt.jwt",
    });

    await expect(bearerAuthMiddleware(config)(options)(ctx, next)).rejects.toThrow(ClientError);
  });

  test("should throw error with custom validation callback", async () => {
    await expect(
      bearerAuthMiddleware(config)({}, async (context) => {
        if (context.token.bearerToken.claims.subject === "c57ed8ee-0797-44dd-921b-3db030879ec6") {
          throw Error("message");
        }
      })(ctx, next),
    ).rejects.toThrow(ClientError);
  });
});
