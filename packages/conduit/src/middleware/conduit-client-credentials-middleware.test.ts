import { Next } from "@lindorm/middleware";
import MockDate from "mockdate";
import nock from "nock";
import { OPEN_ID_CONFIGURATION_RESPONSE } from "../__fixtures__/auth0";
import {
  ConduitClientCredentialsMiddlewareFactory,
  createConduitClientCredentialsMiddleware,
} from "./conduit-client-credentials-middleware";

MockDate.set("2024-01-01T00:00:00.000Z");

describe("conduit-client-credentials-middleware", () => {
  let ctx: any;
  let factory: ConduitClientCredentialsMiddlewareFactory;
  let next: Next;

  const configScope = nock("https://lindorm.eu.auth0.com")
    .get("/.well-known/openid-configuration")
    .times(1)
    .reply(200, OPEN_ID_CONFIGURATION_RESPONSE);

  beforeAll(() => {
    factory = createConduitClientCredentialsMiddleware({
      clientId: "clientId",
      clientSecret: "clientSecret",
      clockTolerance: 0,
      openIdBaseUrl: "https://lindorm.eu.auth0.com/",
    });
  });

  beforeEach(() => {
    ctx = {
      req: { headers: {} },
    };

    next = () => Promise.resolve();
  });

  describe("with audience", () => {
    test("should return a middleware", async () => {
      const tokenScope = nock("https://lindorm.eu.auth0.com")
        .post("/oauth/token")
        .times(1)
        .reply(200, {
          access_token: "access_token",
          expires_in: 10,
          token_type: "Bearer",
        });

      const middleware = await factory({ audience: "https://identity.lindorm-io" });

      expect(configScope.isDone()).toBe(true);
      expect(tokenScope.isDone()).toBe(true);

      await expect(middleware(ctx, next)).resolves.not.toThrow();

      expect(ctx.req.headers).toEqual({
        Authorization: "Bearer access_token",
      });
    });

    test("should return middleware with cached data", async () => {
      const middleware = await factory({ audience: "https://identity.lindorm-io" });

      await expect(middleware(ctx, next)).resolves.not.toThrow();

      expect(ctx.req.headers).toEqual({
        Authorization: "Bearer access_token",
      });
    });

    test("should return middleware with timeout data", async () => {
      const scope = nock("https://lindorm.eu.auth0.com")
        .post("/oauth/token")
        .times(1)
        .reply(200, {
          access_token: "access_token",
          expires_in: 10,
          token_type: "Bearer",
        });

      MockDate.set("2024-01-01T00:00:30.000Z");

      const middleware = await factory({ audience: "https://identity.lindorm-io" });

      expect(scope.isDone()).toBe(true);

      await expect(middleware(ctx, next)).resolves.not.toThrow();

      expect(ctx.req.headers).toEqual({
        Authorization: "Bearer access_token",
      });
    });

    test("should return a middleware with new data", async () => {
      const scope = nock("https://lindorm.eu.auth0.com")
        .post("/oauth/token")
        .times(1)
        .reply(200, {
          access_token: "access_token",
          expires_in: 10,
          token_type: "Bearer",
        });

      const middleware = await factory({ audience: "https://test.lindorm.io" });

      expect(scope.isDone()).toBe(true);

      await expect(middleware(ctx, next)).resolves.not.toThrow();

      expect(ctx.req.headers).toEqual({
        Authorization: "Bearer access_token",
      });
    });
  });

  describe("without audience", () => {
    test("should return a middleware", async () => {
      const scope = nock("https://lindorm.eu.auth0.com")
        .post("/oauth/token")
        .times(1)
        .reply(200, {
          access_token: "access_token",
          expires_in: 10,
          token_type: "Bearer",
        });

      const middleware = await factory();

      expect(configScope.isDone()).toBe(true);
      expect(scope.isDone()).toBe(true);

      await expect(middleware(ctx, next)).resolves.not.toThrow();

      expect(ctx.req.headers).toEqual({
        Authorization: "Bearer access_token",
      });
    });

    test("should return middleware with cached data", async () => {
      const middleware = await factory();

      await expect(middleware(ctx, next)).resolves.not.toThrow();

      expect(ctx.req.headers).toEqual({
        Authorization: "Bearer access_token",
      });
    });
  });
});
