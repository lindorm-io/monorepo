import MockDate from "mockdate";
import nock from "nock";
import { OPEN_ID_CONFIGURATION_RESPONSE } from "../__fixtures__/auth0";
import {
  ConduitClientCredentialsMiddlewareFactory,
  conduitClientCredentialsMiddleware,
} from "./conduit-client-credentials-middleware";

MockDate.set("2024-01-01T00:00:00.000Z");

describe("conduit-client-credentials-middleware", () => {
  let ctx: any;
  let factory: ConduitClientCredentialsMiddlewareFactory;

  const configScope = nock("https://lindorm.eu.auth0.com")
    .get("/.well-known/openid-configuration")
    .times(1)
    .reply(200, OPEN_ID_CONFIGURATION_RESPONSE);

  beforeAll(() => {
    factory = conduitClientCredentialsMiddleware({
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

      await expect(middleware(ctx, jest.fn())).resolves.toBeUndefined();

      expect(ctx.req.headers).toEqual({
        Authorization: "Bearer access_token",
      });
    });

    test("should return middleware with cached data", async () => {
      const middleware = await factory({ audience: "https://identity.lindorm-io" });

      await expect(middleware(ctx, jest.fn())).resolves.toBeUndefined();

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

      await expect(middleware(ctx, jest.fn())).resolves.toBeUndefined();

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

      await expect(middleware(ctx, jest.fn())).resolves.toBeUndefined();

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

      await expect(middleware(ctx, jest.fn())).resolves.toBeUndefined();

      expect(ctx.req.headers).toEqual({
        Authorization: "Bearer access_token",
      });
    });

    test("should return middleware with cached data", async () => {
      const middleware = await factory();

      await expect(middleware(ctx, jest.fn())).resolves.toBeUndefined();

      expect(ctx.req.headers).toEqual({
        Authorization: "Bearer access_token",
      });
    });
  });
});
