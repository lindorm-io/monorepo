import { createMockLogger } from "@lindorm/logger";
import nock from "nock";
import { getAuthClient } from "./get-auth-client";
import { getOpenIdConfiguration as _getOpenIdConfiguration } from "./get-open-id-configuration";

jest.mock("./get-open-id-configuration");

const getOpenIdConfiguration = _getOpenIdConfiguration as jest.Mock;

describe("getAuthClient", () => {
  let config: any;
  let ctx: any;

  beforeEach(() => {
    config = {
      clientId: "clientId",
      clientSecret: "clientSecret",
      issuer: "https://example.com",

      autoRefresh: "none",
      codeChallengeMethod: "S256",
      errorRedirect: "https://example.com/error",
      tokenExpiry: "1h",

      defaults: {
        acrValues: "default_acr_value",
        audience: "default_audience",
        maxAge: "5m",
        prompt: "none",
        responseType: "code token",
        scope: ["openid", "offline_access"],
      },

      cookies: {
        login: "config_login_cookie",
        logout: "config_logout_cookie",
      },

      dynamicRedirectDomains: ["https://client.com"],
    };

    ctx = {
      logger: createMockLogger(),
      request: {
        origin: "https://client.com",
      },
      state: {
        app: {
          environment: "test",
        },
        metadata: {
          correlationId: "d63f8a93-307e-5282-90fb-6795a0866a5e",
        },
      },
    };

    getOpenIdConfiguration.mockReturnValue({
      authorizationEndpoint: "https://example.com/authorize",
      logoutEndpoint: "https://example.com/logout",
      tokenEndpoint: "https://example.com/token",
      userinfoEndpoint: "https://example.com/userinfo",
      tokenEndpointAuthMethodsSupported: ["client_secret_post", "client_secret_basic"],
    });
  });

  test("should return client", () => {
    expect(() => getAuthClient(ctx, config)).not.toThrow();
  });

  test("should return login", () => {
    const login = getAuthClient(ctx, config).login();

    expect(login).toEqual({
      codeChallengeMethod: "S256",
      codeVerifier: expect.any(String),
      nonce: expect.any(String),
      redirect: expect.any(URL),
      responseType: "code token",
      scope: "openid offline_access",
      state: expect.any(String),
    });

    expect(login.redirect.href).toMatch(
      /https:\/\/example.com\/authorize\?acr_values=default_acr_value&audience=default_audience&client_id=clientId&code_challenge=.+&code_challenge_method=S256&max_age=300&nonce=.+&prompt=none&redirect_uri=https%3A%2F%2Fclient.com%2Fauth%2Flogin%2Fcallback&response_type=code\+token&scope=openid\+offline_access&state=.+/,
    );
  });

  test("should return with custom query", () => {
    const login = getAuthClient(ctx, config).login({
      acrValues: "custom_acr_value",
      audience: "custom_audience",
      display: "popup",
      idTokenHint: "id_token_hint",
      loginHint: "login_hint",
      maxAge: "600",
      prompt: "login",
      scope: "openid offline_access profile",
      uiLocales: "en-GB",
    });

    expect(login).toEqual({
      codeChallengeMethod: "S256",
      codeVerifier: expect.any(String),
      nonce: expect.any(String),
      redirect: expect.any(URL),
      responseType: "code token",
      scope: "openid offline_access profile",
      state: expect.any(String),
    });

    expect(login.redirect.href).toMatch(
      /https:\/\/example.com\/authorize\?acr_values=custom_acr_value&audience=custom_audience&client_id=clientId&code_challenge=.+&code_challenge_method=S256&display=popup&id_token_hint=id_token_hint&login_hint=login_hint&max_age=600&nonce=.+&prompt=login&redirect_uri=https%3A%2F%2Fclient.com%2Fauth%2Flogin%2Fcallback&response_type=code\+token&scope=openid\+offline_access\+profile&state=.+&ui_locales=en-GB/,
    );
  });

  test("should return logout", () => {
    const logout = getAuthClient(ctx, config).logout();

    expect(logout).toEqual({
      redirect: expect.any(URL),
      state: expect.any(String),
    });

    expect(logout.redirect.href).toMatch(
      /https:\/\/example.com\/logout\?client_id=clientId&post_logout_redirect_uri=https%3A%2F%2Fclient.com%2Fauth%2Flogout%2Fcallback&state=.+/,
    );
  });

  test("should return logout with custom query", () => {
    const logout = getAuthClient(ctx, config).logout({
      idTokenHint: "id_token_hint",
      logoutHint: "logout_hint",
      uiLocales: "en-GB",
    });

    expect(logout).toEqual({
      redirect: expect.any(URL),
      state: expect.any(String),
    });

    expect(logout.redirect.href).toMatch(
      /https:\/\/example.com\/logout\?client_id=clientId&id_token_hint=id_token_hint&logout_hint=logout_hint&post_logout_redirect_uri=https%3A%2F%2Fclient.com%2Fauth%2Flogout%2Fcallback&state=.+&ui_locales=en-GB/,
    );
  });

  test("should resolve token", async () => {
    const spy = jest.fn();

    nock("https://example.com")
      .post("/token", (body) => {
        spy(body);
        return true;
      })
      .reply(200, {
        token: "token",
      });

    await expect(
      getAuthClient(ctx, config).token({ grantType: "authorization_code" }),
    ).resolves.toEqual({
      token: "token",
    });

    expect(spy).toHaveBeenCalledWith({
      audience: "default_audience",
      client_id: "clientId",
      client_secret: "clientSecret",
      grant_type: "authorization_code",
    });
  });

  test("should resolve userinfo", async () => {
    nock("https://example.com").get("/userinfo").reply(200, {
      userinfo: "userinfo",
    });

    await expect(getAuthClient(ctx, config).userinfo("accessToken")).resolves.toEqual({
      userinfo: "userinfo",
    });
  });
});
