import MockDate from "mockdate";
import nock from "nock";
import { OPEN_ID_CONFIGURATION_RESPONSE } from "../__fixtures__/auth0";
import {
  ConduitClientCredentialsCache,
  ConduitClientCredentialsMiddlewareFactory,
  conduitClientCredentialsMiddlewareFactory,
} from "./conduit-client-credentials-middleware";

const MockedDate = new Date("2024-01-01T00:00:00.000Z");
MockDate.set(MockedDate);

describe("conduit-client-credentials-middleware", () => {
  const cache: ConduitClientCredentialsCache = [];

  let ctx: any;
  let factory: ConduitClientCredentialsMiddlewareFactory;

  const configScope = nock("https://lindorm.eu.auth0.com")
    .get("/.well-known/openid-configuration")
    .times(1)
    .reply(200, OPEN_ID_CONFIGURATION_RESPONSE);

  beforeAll(() => {
    factory = conduitClientCredentialsMiddlewareFactory(
      {
        clientId: "clientId",
        clientSecret: "clientSecret",
        clockTolerance: 0,
        issuer: "https://lindorm.eu.auth0.com/",
      },
      cache,
    );
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

      expect(configScope.isDone()).toEqual(true);
      expect(tokenScope.isDone()).toEqual(true);

      await expect(middleware(ctx, jest.fn())).resolves.toBeUndefined();

      expect(ctx.req.headers).toEqual({
        Authorization: "Bearer access_token",
      });

      expect(cache).toMatchSnapshot();
    });

    test("should return middleware with cached data", async () => {
      const middleware = await factory({ audience: "https://identity.lindorm-io" });

      await expect(middleware(ctx, jest.fn())).resolves.toBeUndefined();

      expect(ctx.req.headers).toEqual({
        Authorization: "Bearer access_token",
      });

      expect(cache).toMatchSnapshot();
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

      expect(scope.isDone()).toEqual(true);

      await expect(middleware(ctx, jest.fn())).resolves.toBeUndefined();

      expect(ctx.req.headers).toEqual({
        Authorization: "Bearer access_token",
      });

      expect(cache).toMatchSnapshot();
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

      expect(scope.isDone()).toEqual(true);

      await expect(middleware(ctx, jest.fn())).resolves.toBeUndefined();

      expect(ctx.req.headers).toEqual({
        Authorization: "Bearer access_token",
      });

      expect(cache).toMatchSnapshot();
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

      expect(configScope.isDone()).toEqual(true);
      expect(scope.isDone()).toEqual(true);

      await expect(middleware(ctx, jest.fn())).resolves.toBeUndefined();

      expect(ctx.req.headers).toEqual({
        Authorization: "Bearer access_token",
      });

      expect(cache).toMatchSnapshot();
    });

    test("should return middleware with cached data", async () => {
      const middleware = await factory();

      await expect(middleware(ctx, jest.fn())).resolves.toBeUndefined();

      expect(ctx.req.headers).toEqual({
        Authorization: "Bearer access_token",
      });

      expect(cache).toMatchSnapshot();
    });
  });

  describe("with internal cache", () => {
    let ctx: any;
    let factory: ConduitClientCredentialsMiddlewareFactory;

    nock("https://lindorm.jp.auth0.com")
      .get("/.well-known/openid-configuration")
      .times(1)
      .reply(200, {
        ...OPEN_ID_CONFIGURATION_RESPONSE,
        token_endpoint: "https://lindorm.jp.auth0.com/oauth/token",
      });

    nock("https://lindorm.jp.auth0.com").post("/oauth/token").times(1).reply(200, {
      access_token: "access_token",
      expires_in: 10,
      token_type: "Bearer",
    });

    beforeAll(() => {
      factory = conduitClientCredentialsMiddlewareFactory({
        clientId: "clientId",
        clientSecret: "clientSecret",
        clockTolerance: 0,
        issuer: "https://lindorm.jp.auth0.com/",
      });
    });

    beforeEach(() => {
      ctx = {
        req: { headers: {} },
      };
    });

    test("should return a middleware", async () => {
      const middleware = await factory();

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

  describe("defaultExpiration TTL calculation", () => {
    test("should calculate TTL as future timestamp when using defaultExpiration", async () => {
      const cache: ConduitClientCredentialsCache = [];

      nock("https://lindorm.se.auth0.com")
        .get("/.well-known/openid-configuration")
        .times(1)
        .reply(200, {
          ...OPEN_ID_CONFIGURATION_RESPONSE,
          token_endpoint: "https://lindorm.se.auth0.com/oauth/token",
        });

      nock("https://lindorm.se.auth0.com").post("/oauth/token").times(1).reply(200, {
        access_token: "access_token_default",
        token_type: "Bearer",
      });

      const factory = conduitClientCredentialsMiddlewareFactory(
        {
          clientId: "clientId",
          clientSecret: "clientSecret",
          clockTolerance: 0,
          issuer: "https://lindorm.se.auth0.com/",
          defaultExpiration: 300,
        },
        cache,
      );

      const middleware = await factory();

      expect(cache.length).toEqual(1);
      expect(cache[0].ttl).toBeGreaterThan(Date.now());
      expect(cache[0].ttl).toBeLessThanOrEqual(Date.now() + 300 * 1000);
    });
  });

  describe("replaceInCache removes expired entries", () => {
    test("should remove expired cache entries during iteration", async () => {
      const cache: ConduitClientCredentialsCache = [];

      nock("https://lindorm.no.auth0.com")
        .get("/.well-known/openid-configuration")
        .times(1)
        .reply(200, {
          ...OPEN_ID_CONFIGURATION_RESPONSE,
          token_endpoint: "https://lindorm.no.auth0.com/oauth/token",
        });

      nock("https://lindorm.no.auth0.com").post("/oauth/token").times(2).reply(200, {
        access_token: "access_token_test",
        expires_in: 1,
        token_type: "Bearer",
      });

      const factory = conduitClientCredentialsMiddlewareFactory(
        {
          clientId: "clientId",
          clientSecret: "clientSecret",
          clockTolerance: 0,
          issuer: "https://lindorm.no.auth0.com/",
        },
        cache,
      );

      await factory({ audience: "https://test.audience" });

      expect(cache.length).toEqual(1);

      MockDate.set(new Date("2024-01-01T00:00:05.000Z"));

      await factory({ audience: "https://test.audience" });

      expect(cache.length).toEqual(1);
    });
  });

  describe("missing tokenEndpoint validation", () => {
    test("should throw ConduitError when OIDC discovery does not return tokenEndpoint", async () => {
      nock("https://lindorm.fi.auth0.com")
        .get("/.well-known/openid-configuration")
        .times(1)
        .reply(200, {
          ...OPEN_ID_CONFIGURATION_RESPONSE,
          token_endpoint: undefined,
        });

      const factory = conduitClientCredentialsMiddlewareFactory({
        clientId: "clientId",
        clientSecret: "clientSecret",
        clockTolerance: 0,
        issuer: "https://lindorm.fi.auth0.com/",
      });

      await expect(factory()).rejects.toThrow(
        "Token endpoint not found in OpenID configuration",
      );
    });
  });

  describe("concurrent factory calls token deduplication", () => {
    test("should share same in-flight token promise when called concurrently", async () => {
      const cache: ConduitClientCredentialsCache = [];

      nock("https://lindorm.dk.auth0.com")
        .get("/.well-known/openid-configuration")
        .times(1)
        .reply(200, {
          ...OPEN_ID_CONFIGURATION_RESPONSE,
          token_endpoint: "https://lindorm.dk.auth0.com/oauth/token",
        });

      // Only mock ONE token request - if deduplication works, both calls share this request
      nock("https://lindorm.dk.auth0.com").post("/oauth/token").times(1).reply(200, {
        access_token: "shared_token",
        expires_in: 300,
        token_type: "Bearer",
      });

      const factory = conduitClientCredentialsMiddlewareFactory(
        {
          clientId: "clientId",
          clientSecret: "clientSecret",
          clockTolerance: 0,
          issuer: "https://lindorm.dk.auth0.com/",
        },
        cache,
      );

      // Call factory twice concurrently with same audience
      const [middleware1, middleware2] = await Promise.all([
        factory({ audience: "https://shared.audience" }),
        factory({ audience: "https://shared.audience" }),
      ]);

      const ctx1: any = { req: { headers: {} } };
      const ctx2: any = { req: { headers: {} } };

      await middleware1(ctx1, jest.fn());
      await middleware2(ctx2, jest.fn());

      // Both should have the same token
      expect(ctx1.req.headers.Authorization).toBe("Bearer shared_token");
      expect(ctx2.req.headers.Authorization).toBe("Bearer shared_token");

      // Cache should only have one entry
      expect(cache.length).toBe(1);
    });
  });
});
