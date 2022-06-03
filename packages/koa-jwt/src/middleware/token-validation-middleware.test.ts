import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { Metric } from "@lindorm-io/koa";
import { createMockLogger } from "@lindorm-io/winston";
import { tokenValidationMiddleware } from "./token-validation-middleware";
import { createTestJwt } from "@lindorm-io/jwt";

MockDate.set("2021-01-01T08:00:00.000Z");

const next = () => Promise.resolve();

describe("tokenValidationMiddleware", () => {
  let middlewareOptions: any;
  let options: any;
  let optionsPath: any;
  let path: string;
  let ctx: any;

  const logger = createMockLogger();

  beforeEach(() => {
    const jwt = createTestJwt();
    const { token } = jwt.sign({
      audiences: ["45270e26-3d10-4827-9b79-10cbd9d426bc"],
      expiry: "99 seconds",
      nonce: "6142a95bc7004df59e365e37516170a9",
      scopes: ["default", "edit"],
      subject: "c57ed8ee-0797-44dd-921b-3db030879ec6",
      subjectHint: "identity",
      type: "type",
    });

    middlewareOptions = {
      clockTolerance: 1,
      issuer: "issuer",
      contextKey: "tokenKey",
      maxAge: "90 minutes",
      subjectHint: "identity",
      type: "type",
    };
    options = {
      audiences: ["45270e26-3d10-4827-9b79-10cbd9d426bc"],
      nonce: "6142a95bc7004df59e365e37516170a9",
      optional: false,
      scopes: ["default"],
      subjects: ["c57ed8ee-0797-44dd-921b-3db030879ec6"],
    };
    optionsPath = {
      audiencePath: "metadata.clientId",
      noncePath: "request.body.nonce",
      optional: false,
      scopesPath: "request.body.scopes",
      subjectPath: "request.body.subject",
    };
    path = "request.body.tokenPath";

    ctx = {
      jwt,
      logger,
      metadata: {
        clientId: "45270e26-3d10-4827-9b79-10cbd9d426bc",
      },
      metrics: {},
      request: {
        body: {
          nonce: "6142a95bc7004df59e365e37516170a9",
          scopes: ["default"],
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
      tokenValidationMiddleware(middlewareOptions)(path, options)(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.token.tokenKey).toStrictEqual(
      expect.objectContaining({
        subject: "c57ed8ee-0797-44dd-921b-3db030879ec6",
        token: expect.any(String),
      }),
    );
    expect(ctx.metrics.token).toStrictEqual(expect.any(Number));
  });

  test("should validate token on path with options on path", async () => {
    await expect(
      tokenValidationMiddleware(middlewareOptions)(path, optionsPath)(ctx, next),
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
      tokenValidationMiddleware(middlewareOptions)(path, {}, async (context, verifyData) => {
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
      tokenValidationMiddleware(middlewareOptions)(path, options)(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.token.tokenKey).toBeUndefined();
  });

  test("should throw when token is not on path", async () => {
    ctx.request.body.tokenPath = undefined;

    await expect(tokenValidationMiddleware(middlewareOptions)(path)(ctx, next)).rejects.toThrow(
      ClientError,
    );
  });

  test("should throw error with custom validation callback", async () => {
    await expect(
      tokenValidationMiddleware(middlewareOptions)(path, {}, async (context) => {
        if (context.token.tokenKey.subject === "c57ed8ee-0797-44dd-921b-3db030879ec6") {
          throw Error("message");
        }
      })(ctx, next),
    ).rejects.toThrow(ClientError);
  });
});
