import { ClientError } from "@lindorm/errors";
import { getAuthClient as _getAuthClient } from "./get-auth-client";
import { createLogoutHandler } from "./logout-handler";

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
        logout: "https://client.com/logout",
      },
    };

    ctx = {
      cookies: {
        get: jest.fn().mockResolvedValue({
          redirectUri: "https://example.com",
          state: "state",
        }),
        set: jest.fn(),
        del: jest.fn(),
      },
      data: {
        idTokenHint: "idTokenHint",
        logoutHint: "logoutHint",
        redirectUri: "https://client.com/redirect",
      },
      redirect: jest.fn(),
      session: {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
      },
      state: {
        session: {
          accessToken: "accessToken",
          idToken: "idToken",
          scope: ["scope"],
          subject: "subject",
        },
      },
    };

    getAuthClient.mockReturnValue({
      logout: jest.fn().mockReturnValue({
        redirect: new URL("/auth/logout/callback", "https://example.com"),
        state: "state",
      }),
    });
  });

  afterEach(jest.clearAllMocks);

  test("should resolve dynamic redirect uri", async () => {
    await expect(createLogoutHandler(config)(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.cookies.del).toHaveBeenCalled();
    expect(ctx.cookies.set).toHaveBeenCalledWith(
      "logout_cookie",
      {
        redirectUri: "https://client.com/redirect",
        state: "state",
      },
      { expiry: "15m" },
    );
    expect(ctx.redirect).toHaveBeenCalledWith("https://example.com/auth/logout/callback");
  });

  test("should resolve static redirect uri", async () => {
    ctx.data.redirectUri = undefined;

    await expect(createLogoutHandler(config)(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.cookies.del).toHaveBeenCalled();
    expect(ctx.cookies.set).toHaveBeenCalledWith(
      "logout_cookie",
      {
        redirectUri: "https://client.com/logout",
        state: "state",
      },
      { expiry: "15m" },
    );
    expect(ctx.redirect).toHaveBeenCalledWith("https://example.com/auth/logout/callback");
  });

  test("should throw on missing session", async () => {
    ctx.state.session = undefined;

    await expect(createLogoutHandler(config)(ctx, jest.fn())).rejects.toThrow(
      ClientError,
    );
  });

  test("should throw on invalid redirect uri domain", async () => {
    ctx.data.redirectUri = "https://invalid.com/redirect";

    await expect(createLogoutHandler(config)(ctx, jest.fn())).rejects.toThrow(
      ClientError,
    );
  });

  test("should throw on missing redirect uri", async () => {
    config.staticRedirect.logout = undefined;
    ctx.data.redirectUri = undefined;

    await expect(createLogoutHandler(config)(ctx, jest.fn())).rejects.toThrow(
      ClientError,
    );
  });
});
