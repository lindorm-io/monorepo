import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { Metric } from "@lindorm-io/koa";
import { bearerAuthMiddleware } from "./bearer-auth-middleware";
import { createTestJwt } from "@lindorm-io/jwt";
import { createMockLogger } from "@lindorm-io/winston";

MockDate.set("2021-01-01T08:00:00.000Z");

const next = () => Promise.resolve();

describe("bearerAuthMiddleware", () => {
  let middlewareOptions: any;
  let options: any;
  let optionsPath: any;
  let ctx: any;

  const logger = createMockLogger();

  beforeEach(() => {
    const jwt = createTestJwt();
    const { token } = jwt.sign({
      audiences: ["444a9836-d2c9-470e-9270-071bfcb61346"],
      expiry: "99 seconds",
      nonce: "6142a95bc7004df59e365e37516170a9",
      scopes: ["default", "edit"],
      subject: "c57ed8ee-0797-44dd-921b-3db030879ec6",
      subjectHint: "identity",
      type: "access_token",
    });

    middlewareOptions = {
      issuer: "issuer",
      maxAge: "90 minutes",
      subjectHint: "identity",
    };
    options = {
      audiences: ["444a9836-d2c9-470e-9270-071bfcb61346"],
      nonce: "6142a95bc7004df59e365e37516170a9",
      scopes: ["default"],
      subject: "c57ed8ee-0797-44dd-921b-3db030879ec6",
    };
    optionsPath = {
      audiencePath: "metadata.clientId",
      noncePath: "request.body.nonce",
      scopesPath: "request.body.scopes",
      subjectPath: "request.body.subject",
    };

    ctx = {
      jwt,
      logger,
      metadata: {
        clientId: "444a9836-d2c9-470e-9270-071bfcb61346",
      },
      metrics: {},
      request: {
        body: {
          nonce: "6142a95bc7004df59e365e37516170a9",
          scopes: ["default"],
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
    await expect(
      bearerAuthMiddleware(middlewareOptions)(options)(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.token.bearerToken).toStrictEqual(
      expect.objectContaining({
        subject: "c57ed8ee-0797-44dd-921b-3db030879ec6",
        token: expect.any(String),
      }),
    );
    expect(ctx.metrics.auth).toStrictEqual(expect.any(Number));
  });

  test("should successfully validate bearer token auth with path options", async () => {
    await expect(
      bearerAuthMiddleware(middlewareOptions)(optionsPath)(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.token.bearerToken).toStrictEqual(
      expect.objectContaining({
        subject: "c57ed8ee-0797-44dd-921b-3db030879ec6",
        token: expect.any(String),
      }),
    );
    expect(ctx.metrics.auth).toStrictEqual(expect.any(Number));
  });

  test("should successfully validate bearer token with custom validation callback", async () => {
    await expect(
      bearerAuthMiddleware(middlewareOptions)({}, async (context, verifyData) => {
        if (verifyData.subject !== "c57ed8ee-0797-44dd-921b-3db030879ec6") {
          throw Error("message");
        }
      })(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.token.bearerToken).toBeTruthy();
  });

  test("should throw error on missing Bearer Token Auth", async () => {
    ctx.getAuthorizationHeader = () => ({
      type: "Basic",
      value: "base64",
    });

    await expect(bearerAuthMiddleware(middlewareOptions)(options)(ctx, next)).rejects.toThrow(
      ClientError,
    );
  });

  test("should throw error on erroneous token verification", async () => {
    ctx.getAuthorizationHeader = () => ({
      type: "Bearer",
      value: "jwt.jwt.jwt",
    });

    await expect(bearerAuthMiddleware(middlewareOptions)(options)(ctx, next)).rejects.toThrow(
      ClientError,
    );
  });

  test("should throw error with custom validation callback", async () => {
    await expect(
      bearerAuthMiddleware(middlewareOptions)({}, async (context) => {
        if (context.token.bearerToken.subject === "c57ed8ee-0797-44dd-921b-3db030879ec6") {
          throw Error("message");
        }
      })(ctx, next),
    ).rejects.toThrow(ClientError);
  });
});
