// The login flow end to end — login handler, real driver, real HTTP, callback
// handler — because the parts that matter here are the ones that only exist
// BETWEEN the units: the callback URI computed at authorize and replayed at the
// exchange (RFC 6749 §4.1.3), the PKCE verifier stored in the cookie and
// redeemed a request later, and the subject resolved through the driver for a
// provider that returns no id_token at all.

import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { OpenIdConfiguration } from "@lindorm/openid";
import axios from "axios";
import nock from "nock";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Auth0Driver } from "../../../drivers/auth/Auth0Driver.js";
import { OpenIdDriver } from "../../../drivers/auth/OpenIdDriver.js";
import type { IPylonAuthDriver } from "../../../interfaces/index.js";
import type {
  PylonAuthConfig,
  PylonAuthRouterConfig,
  PylonLoginCookie,
} from "../../../types/index.js";
import { createAuthClient } from "./create-auth-client.js";
import { createLoginCallbackHandler } from "./login-callback-handler.js";
import { createLoginHandler } from "./login-handler.js";

axios.defaults.proxy = false;

const ISSUER = "https://auth.lindorm.io";
const ORIGIN = "https://app.lindorm.io";

const ROUTER: PylonAuthRouterConfig = {
  errorRedirect: "/auth/error",
  pathPrefix: "/auth",
  dynamicRedirectDomains: ["https://client.lindorm.io"],
  cookies: { login: "pylon_login_session", logout: "pylon_logout_session" },
  staticRedirect: { login: null, logout: null },
};

describe("auth flow", () => {
  let cookies: Map<string, unknown>;
  let openIdConfiguration: Partial<OpenIdConfiguration>;
  let tokenRequest: Record<string, string>;
  let redirected: Array<string>;
  let session: unknown;

  const createCtx = (data: object): any => ({
    aegis: {
      // The provider issues an OPAQUE access token, so there is nothing for
      // aegis to read claims out of — the subject has to come from the driver.
      verify: vi.fn().mockResolvedValue({ format: "jws" }),
    },
    amphora: {
      idp: { config: () => ({ issuer: ISSUER, openIdConfiguration }) },
    },
    cookies: {
      get: async (name: string) => cookies.get(name) ?? null,
      set: async (name: string, value: unknown) => cookies.set(name, value),
      del: (name: string) => cookies.delete(name),
    },
    data,
    logger: createMockLogger(),
    redirect: (url: string) => redirected.push(url),
    session: {
      set: async (value: unknown) => {
        session = value;
      },
      del: vi.fn(),
    },
    state: {
      app: { environment: "test" },
      metadata: { correlationId: "test-correlation" },
      origin: ORIGIN,
      session: null,
      tokens: {},
    },
  });

  const createConfig = (driver: IPylonAuthDriver): PylonAuthConfig => ({
    driver,
    defaultTokenExpiry: "1d",
    refresh: { maxAge: "1h", mode: "half_life" },
    router: ROUTER,
  });

  const captureToken = (): nock.Scope =>
    nock(ISSUER)
      .post("/token")
      .times(1)
      .reply(200, function (_uri, body) {
        tokenRequest = Object.fromEntries(new URLSearchParams(body as string));
        return {
          access_token: "opaque-access-token",
          token_type: "Bearer",
          expires_in: 3600,
          refresh_token: "opaque-refresh-token",
          scope: "openid profile",
        };
      });

  const captureUserinfo = (): nock.Scope =>
    nock(ISSUER).get("/userinfo").times(1).reply(200, { sub: "alice" });

  /** Drive `/login` and hand back the URL the browser was sent to. */
  const login = async (config: PylonAuthConfig): Promise<URL> => {
    const ctx = createCtx({ redirectUri: "https://client.lindorm.io/welcome" });
    ctx.auth = createAuthClient(ctx, config);

    await createLoginHandler(ROUTER)(ctx, vi.fn());

    return new URL(redirected[redirected.length - 1]);
  };

  /** Drive `/login/callback` with the code the provider "returned". */
  const callback = async (config: PylonAuthConfig, state: string): Promise<void> => {
    const ctx = createCtx({ code: "authorization-code", state });
    ctx.auth = createAuthClient(ctx, config);

    await createLoginCallbackHandler(config)(ctx, vi.fn());
  };

  beforeEach(() => {
    cookies = new Map();
    redirected = [];
    session = null;
    tokenRequest = {};
    nock.cleanAll();

    openIdConfiguration = {
      issuer: ISSUER,
      authorizationEndpoint: `${ISSUER}/authorize`,
      tokenEndpoint: `${ISSUER}/token`,
      jwksUri: `${ISSUER}/jwks`,
      userinfoEndpoint: `${ISSUER}/userinfo`,
    };
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe("OpenIdDriver", () => {
    const driver = new OpenIdDriver({
      clientId: "client-id",
      clientSecret: "client-secret",
      issuer: ISSUER,
      authorize: { scope: ["openid", "profile"] },
    });

    test("should complete a code flow from /login to a session", async () => {
      const config = createConfig(driver);
      const token = captureToken();
      const userinfo = captureUserinfo();

      const authorize = await login(config);
      const cookie = cookies.get(ROUTER.cookies.login) as PylonLoginCookie;

      await callback(config, cookie.state);

      expect(token.isDone()).toBe(true);
      expect(userinfo.isDone()).toBe(true);

      expect(tokenRequest).toEqual({
        code: "authorization-code",
        code_verifier: cookie.codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: `${ORIGIN}/auth/login/callback`,
        scope: "openid profile",
      });

      expect(session).toMatchObject({
        accessToken: "opaque-access-token",
        refreshToken: "opaque-refresh-token",
        scope: ["openid", "profile"],
        subject: "alice",
      });

      // The login cookie is spent, and the browser lands where it asked to.
      expect(cookies.has(ROUTER.cookies.login)).toBe(false);
      expect(redirected[1]).toBe("https://client.lindorm.io/welcome");
      expect(authorize.origin + authorize.pathname).toBe(`${ISSUER}/authorize`);
    });

    // ⚠ R1. RFC 6749 §4.1.3 requires the exchange's `redirect_uri` to be
    // IDENTICAL to the authorization request's. It used to be built twice, from
    // the same inputs, with nothing holding the two together.
    test("should send the exchange the very redirect_uri the authorize request carried", async () => {
      const config = createConfig(driver);
      captureToken();
      captureUserinfo();

      const authorize = await login(config);
      const cookie = cookies.get(ROUTER.cookies.login) as PylonLoginCookie;

      await callback(config, cookie.state);

      expect(authorize.searchParams.get("redirect_uri")).toBe(cookie.callbackUri);
      expect(tokenRequest.redirect_uri).toBe(authorize.searchParams.get("redirect_uri"));
    });

    test("should carry pylon's state, nonce and code challenge onto the authorize url", async () => {
      const authorize = await login(createConfig(driver));
      const cookie = cookies.get(ROUTER.cookies.login) as PylonLoginCookie;

      expect(authorize.searchParams.get("state")).toBe(cookie.state);
      expect(authorize.searchParams.get("nonce")).toBe(cookie.nonce);
      expect(authorize.searchParams.get("code_challenge_method")).toBe("S256");
      expect(authorize.searchParams.get("code_challenge")).toEqual(expect.any(String));
      expect(authorize.searchParams.get("code_challenge")).not.toBe(cookie.codeVerifier);
      expect(authorize.searchParams.get("client_id")).toBe("client-id");
      expect(authorize.searchParams.get("scope")).toBe("openid profile");
    });

    // RFC 6749 §2.3: "The client MUST NOT use more than one authentication
    // method in each request." The old path composed `client_secret_post` and
    // the basic-auth middleware independently, so a provider advertising both
    // received the credentials twice.
    test("should authenticate the token request exactly once", async () => {
      openIdConfiguration.tokenEndpointAuthMethodsSupported = [
        "client_secret_basic",
        "client_secret_post",
      ];

      const config = createConfig(driver);
      let authorization: string | undefined;

      nock(ISSUER)
        .post("/token")
        .times(1)
        .reply(200, function (_uri, body) {
          authorization = this.req.headers["authorization"] as string | undefined;
          tokenRequest = Object.fromEntries(new URLSearchParams(body as string));
          return { access_token: "opaque-access-token", token_type: "Bearer" };
        });
      captureUserinfo();

      await login(config);
      const cookie = cookies.get(ROUTER.cookies.login) as PylonLoginCookie;
      await callback(config, cookie.state);

      expect(authorization).toBe(
        `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`,
      );
      expect(tokenRequest.client_id).toBeUndefined();
      expect(tokenRequest.client_secret).toBeUndefined();
    });

    // RFC 7662 §2.1 and RFC 6749 §4.1.3 both require form encoding. Auth0
    // tolerates JSON, which is how posting JSON went unnoticed for so long;
    // Discord and others reject it outright.
    test("should post the exchange as application/x-www-form-urlencoded", async () => {
      const config = createConfig(driver);
      let contentType: string | undefined;

      nock(ISSUER)
        .post("/token")
        .times(1)
        .reply(200, function (_uri, body) {
          contentType = this.req.headers["content-type"] as string | undefined;
          tokenRequest = Object.fromEntries(new URLSearchParams(body as string));
          return { access_token: "opaque-access-token", token_type: "Bearer" };
        });
      captureUserinfo();

      await login(config);
      const cookie = cookies.get(ROUTER.cookies.login) as PylonLoginCookie;
      await callback(config, cookie.state);

      expect(contentType).toBe("application/x-www-form-urlencoded");
      expect(tokenRequest.grant_type).toBe("authorization_code");
    });
  });

  // The whole vendor difference, and the test of whether the seam sits in the
  // right place: no pylon-side flag, no branch in the router.
  describe("Auth0Driver", () => {
    const driver = new Auth0Driver({
      clientId: "client-id",
      clientSecret: "client-secret",
      issuer: ISSUER,
      authorize: {
        resource: "https://api.lindorm.io",
        scope: ["openid", "profile"],
      },
    });

    test("should send the resource indicator as audience and never as resource", async () => {
      const authorize = await login(createConfig(driver));

      expect(authorize.searchParams.get("audience")).toBe("https://api.lindorm.io");
      expect(authorize.searchParams.get("resource")).toBeNull();
    });

    test("should complete the same code flow as the OpenID driver", async () => {
      const config = createConfig(driver);
      const token = captureToken();
      captureUserinfo();

      await login(config);
      const cookie = cookies.get(ROUTER.cookies.login) as PylonLoginCookie;

      await callback(config, cookie.state);

      expect(token.isDone()).toBe(true);
      expect(tokenRequest.redirect_uri).toBe(`${ORIGIN}/auth/login/callback`);
      expect(session).toMatchObject({ subject: "alice" });
    });
  });
});
