import { ClientError } from "@lindorm/errors";
import { createLogoutHandler } from "./logout-handler.js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

describe("createLogoutHandler", () => {
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
        logout: "https://client.com/logout",
      },
    };

    ctx = {
      auth: {
        logout: vi.fn().mockReturnValue({
          redirect: new URL("/auth/logout/callback", "https://example.com"),
          state: "state",
        }),
      },
      cookies: {
        get: vi.fn().mockResolvedValue({
          redirectUri: "https://example.com",
          state: "state",
        }),
        set: vi.fn(),
        del: vi.fn(),
      },
      data: {
        idTokenHint: "idTokenHint",
        logoutHint: "logoutHint",
        redirectUri: "https://client.com/redirect",
      },
      redirect: vi.fn(),
      session: {
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn(),
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
  });

  afterEach(vi.clearAllMocks);

  test("should resolve dynamic redirect uri", async () => {
    await expect(
      createLogoutHandler(routerConfig)(ctx, vi.fn()),
    ).resolves.toBeUndefined();

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

    await expect(
      createLogoutHandler(routerConfig)(ctx, vi.fn()),
    ).resolves.toBeUndefined();

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

    await expect(createLogoutHandler(routerConfig)(ctx, vi.fn())).rejects.toThrow(
      ClientError,
    );
  });

  test("should throw on invalid redirect uri domain", async () => {
    ctx.data.redirectUri = "https://invalid.com/redirect";

    await expect(createLogoutHandler(routerConfig)(ctx, vi.fn())).rejects.toThrow(
      ClientError,
    );
  });

  test("should throw on missing redirect uri", async () => {
    routerConfig.staticRedirect.logout = undefined;
    ctx.data.redirectUri = undefined;

    await expect(createLogoutHandler(routerConfig)(ctx, vi.fn())).rejects.toThrow(
      ClientError,
    );
  });
});
