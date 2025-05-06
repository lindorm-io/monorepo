import { ClientError } from "@lindorm/errors";
import { getAuthClient as _getAuthClient } from "./get-auth-client";
import { createLoginHandler } from "./login-handler";

jest.mock("./get-auth-client");

const getAuthClient = _getAuthClient as jest.Mock;

describe("createLoginHandler", () => {
  let config: any;
  let ctx: any;

  beforeEach(() => {
    config = {
      cookies: {
        login: "login_cookie",
        logout: "logout_cookie",
      },

      dynamicRedirectDomains: ["https://client.com"],

      staticRedirect: {
        login: "https://client.com/login",
      },
    };

    ctx = {
      cookies: {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
      },
      data: {
        audience: "audience",
        acrValues: "acrValues",
        display: "display",
        idTokenHint: "idTokenHint",
        loginHint: "loginHint",
        maxAge: "maxAge",
        prompt: "prompt",
        scope: "scope",
        uiLocales: "uiLocales",
        redirectUri: "https://client.com/redirect",
      },
      redirect: jest.fn(),
    };

    getAuthClient.mockReturnValue({
      login: jest.fn().mockReturnValue({
        codeChallengeMethod: "codeChallengeMethod",
        codeVerifier: "codeVerifier",
        nonce: "nonce",
        redirect: new URL("/auth/login/callback", "https://example.com"),
        responseType: "responseType",
        scope: "scope",
        state: "state",
      }),
    });
  });

  afterEach(jest.clearAllMocks);

  test("should resolve dynamic redirect uri", async () => {
    await expect(createLoginHandler(config)(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.cookies.del).toHaveBeenCalled();
    expect(ctx.cookies.set).toHaveBeenCalledWith(
      "login_cookie",
      {
        codeChallengeMethod: "codeChallengeMethod",
        codeVerifier: "codeVerifier",
        nonce: "nonce",
        redirectUri: "https://client.com/redirect",
        responseType: "responseType",
        scope: "scope",
        state: "state",
      },
      { expiry: "15m" },
    );
    expect(ctx.redirect).toHaveBeenCalledWith("https://example.com/auth/login/callback");
  });

  test("should resolve static redirect uri", async () => {
    ctx.data.redirectUri = undefined;

    await expect(createLoginHandler(config)(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.cookies.del).toHaveBeenCalled();
    expect(ctx.cookies.set).toHaveBeenCalledWith(
      "login_cookie",
      {
        codeChallengeMethod: "codeChallengeMethod",
        codeVerifier: "codeVerifier",
        nonce: "nonce",
        redirectUri: "https://client.com/login",
        responseType: "responseType",
        scope: "scope",
        state: "state",
      },
      { expiry: "15m" },
    );
    expect(ctx.redirect).toHaveBeenCalledWith("https://example.com/auth/login/callback");
  });

  test("should throw on missing redirect uri", async () => {
    config.staticRedirect.login = undefined;
    ctx.data.redirectUri = undefined;

    await expect(createLoginHandler(config)(ctx, jest.fn())).rejects.toThrow(ClientError);
  });

  test("should throw on invalid redirect uri domain", async () => {
    ctx.data.redirectUri = "https://invalid.com/redirect";

    await expect(createLoginHandler(config)(ctx, jest.fn())).rejects.toThrow(ClientError);
  });
});
