import { ClientError } from "@lindorm/errors";
import { createLoginHandler } from "./login-handler";

describe("createLoginHandler", () => {
  let routerConfig: any;
  let ctx: any;

  beforeEach(() => {
    routerConfig = {
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
      auth: {
        login: jest.fn().mockReturnValue({
          codeChallengeMethod: "codeChallengeMethod",
          codeVerifier: "codeVerifier",
          nonce: "nonce",
          redirect: new URL("/auth/login/callback", "https://example.com"),
          responseType: "responseType",
          scope: "scope",
          state: "state",
        }),
      },
      cookies: {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
      },
      data: {
        acrValues: "acrValues",
        display: "display",
        idTokenHint: "idTokenHint",
        loginHint: "loginHint",
        maxAge: "maxAge",
        prompt: "prompt",
        resource: "resource",
        scope: "scope",
        uiLocales: "uiLocales",
        redirectUri: "https://client.com/redirect",
      },
      redirect: jest.fn(),
    };
  });

  afterEach(jest.clearAllMocks);

  test("should resolve dynamic redirect uri", async () => {
    await expect(
      createLoginHandler(routerConfig)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

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
      { encrypted: true, httpOnly: true, expiry: "15m" },
    );
    expect(ctx.redirect).toHaveBeenCalledWith("https://example.com/auth/login/callback");
  });

  test("should resolve static redirect uri", async () => {
    ctx.data.redirectUri = undefined;

    await expect(
      createLoginHandler(routerConfig)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

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
      { encrypted: true, httpOnly: true, expiry: "15m" },
    );
    expect(ctx.redirect).toHaveBeenCalledWith("https://example.com/auth/login/callback");
  });

  test("should throw on missing redirect uri", async () => {
    routerConfig.staticRedirect.login = undefined;
    ctx.data.redirectUri = undefined;

    await expect(createLoginHandler(routerConfig)(ctx, jest.fn())).rejects.toThrow(
      ClientError,
    );
  });

  test("should throw on invalid redirect uri domain", async () => {
    ctx.data.redirectUri = "https://invalid.com/redirect";

    await expect(createLoginHandler(routerConfig)(ctx, jest.fn())).rejects.toThrow(
      ClientError,
    );
  });
});
