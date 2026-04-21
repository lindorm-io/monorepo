import { ClientError } from "@lindorm/errors";
import { createLoginCallbackHandler } from "./login-callback-handler.js";
import { parseTokenData as _parseTokenData } from "./parse-token-data.js";
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";

vi.mock("./parse-token-data.js");

const parseTokenData = _parseTokenData as Mock;

describe("createLoginCallbackHandler", async () => {
  let authConfig: any;
  let ctx: any;

  beforeEach(() => {
    authConfig = {
      defaultTokenExpiry: "1d",
      router: {
        cookies: {
          login: "login_cookie",
        },
        errorRedirect: "/auth/error",
        pathPrefix: "/auth",
      },
    };

    ctx = {
      aegis: {
        verify: vi.fn().mockResolvedValue({
          header: { baseFormat: "JWT" },
          payload: { nonce: "nonce" },
        }),
      },
      auth: {
        token: vi.fn().mockResolvedValue({ data: true }),
      },
      cookies: {
        get: vi.fn().mockResolvedValue({
          codeChallengeMethod: "codeChallengeMethod",
          codeVerifier: "codeVerifier",
          nonce: "nonce",
          redirectUri: "redirectUri",
          responseType: "code",
          scope: "scope",
          state: "state",
        }),
        set: vi.fn(),
        del: vi.fn(),
      },
      data: {
        state: "state",
        code: "code",
      },
      redirect: vi.fn(),
      request: {
        origin: "http://localhost",
      },
      session: {
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn(),
      },
      state: {
        origin: "http://localhost",
      },
    };

    parseTokenData.mockResolvedValue({
      accessToken: "accessToken",
      idToken: "idToken",
      subject: "subject",
    });
  });

  afterEach(vi.clearAllMocks);

  test("should resolve with code", async () => {
    await expect(
      createLoginCallbackHandler(authConfig)(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.auth.token).toHaveBeenCalled();

    expect(ctx.session.set).toHaveBeenCalledWith({
      accessToken: "accessToken",
      idToken: "idToken",
      subject: "subject",
    });

    expect(ctx.redirect).toHaveBeenCalledWith("redirectUri");
  });

  test("should resolve with token", async () => {
    ctx.cookies.get.mockResolvedValueOnce({
      codeChallengeMethod: "codeChallengeMethod",
      codeVerifier: "codeVerifier",
      nonce: "nonce",
      redirectUri: "redirectUri",
      responseType: "token",
      scope: "scope",
      state: "state",
    });

    await expect(
      createLoginCallbackHandler(authConfig)(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.session.set).toHaveBeenCalledWith({
      accessToken: "accessToken",
      idToken: "idToken",
      subject: "subject",
    });

    expect(ctx.redirect).toHaveBeenCalledWith("redirectUri");
  });

  test("should resolve with nonce verification via aegis verify", async () => {
    await expect(
      createLoginCallbackHandler(authConfig)(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.aegis.verify).toHaveBeenCalledWith("idToken");
  });

  test("should throw on invalid state", async () => {
    ctx.data.state = "wrong";

    await expect(createLoginCallbackHandler(authConfig)(ctx, vi.fn())).rejects.toThrow(
      ClientError,
    );
  });

  test("should throw on missing session", async () => {
    ctx.cookies.get.mockResolvedValueOnce({
      codeChallengeMethod: "codeChallengeMethod",
      codeVerifier: "codeVerifier",
      nonce: "nonce",
      redirectUri: "redirectUri",
      responseType: "wrong",
      scope: "scope",
      state: "state",
    });

    await expect(createLoginCallbackHandler(authConfig)(ctx, vi.fn())).rejects.toThrow(
      ClientError,
    );
  });

  describe("OAuth error response (RFC 6749 §4.1.2.1)", () => {
    test("should redirect to errorRedirect when IdP returns an error", async () => {
      ctx.data = {
        error: "access_denied",
        errorDescription: "User denied the request",
        state: "state",
      };

      await createLoginCallbackHandler(authConfig)(ctx, vi.fn());

      expect(ctx.redirect).toHaveBeenCalledTimes(1);
      const redirectArg = (ctx.redirect as Mock).mock.calls[0][0] as string;
      const url = new URL(redirectArg);
      expect(url.pathname).toBe("/auth/error");
      expect(url.searchParams.get("error")).toBe("access_denied");
      expect(url.searchParams.get("error_description")).toBe("User denied the request");
      expect(url.searchParams.get("state")).toBe("state");

      // Cookie should be cleaned up
      expect(ctx.cookies.del).toHaveBeenCalledWith("login_cookie");

      // No session should be created
      expect(ctx.session.set).not.toHaveBeenCalled();

      // Token exchange should NOT happen
      expect(ctx.auth.token).not.toHaveBeenCalled();
    });

    test("should redirect to errorRedirect even without state or description", async () => {
      ctx.data = { error: "server_error" };

      await createLoginCallbackHandler(authConfig)(ctx, vi.fn());

      const redirectArg = (ctx.redirect as Mock).mock.calls[0][0] as string;
      const url = new URL(redirectArg);
      expect(url.searchParams.get("error")).toBe("server_error");
      expect(url.searchParams.get("error_description")).toBeNull();
      expect(url.searchParams.get("state")).toBeNull();
    });

    test("should propagate error_uri when present", async () => {
      ctx.data = {
        error: "invalid_scope",
        errorUri: "https://idp.example.com/errors/invalid_scope",
      };

      await createLoginCallbackHandler(authConfig)(ctx, vi.fn());

      const redirectArg = (ctx.redirect as Mock).mock.calls[0][0] as string;
      const url = new URL(redirectArg);
      expect(url.searchParams.get("error_uri")).toBe(
        "https://idp.example.com/errors/invalid_scope",
      );
    });

    test("should not delete cookie when none was set", async () => {
      ctx.data = { error: "access_denied" };
      ctx.cookies.get.mockResolvedValueOnce(null);

      await createLoginCallbackHandler(authConfig)(ctx, vi.fn());

      expect(ctx.cookies.del).not.toHaveBeenCalled();
      expect(ctx.redirect).toHaveBeenCalled();
    });
  });

  test("should throw on invalid nonce", async () => {
    ctx.aegis.verify.mockResolvedValueOnce({
      header: { baseFormat: "JWT" },
      payload: { nonce: "wrong_nonce" },
    });

    ctx.cookies.get.mockResolvedValueOnce({
      codeChallengeMethod: "codeChallengeMethod",
      codeVerifier: "codeVerifier",
      nonce: "expected_nonce",
      redirectUri: "redirectUri",
      responseType: "code",
      scope: "scope",
      state: "state",
    });

    await expect(createLoginCallbackHandler(authConfig)(ctx, vi.fn())).rejects.toThrow(
      ClientError,
    );
  });
});
