import { ClientError, ServerError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../../__fixtures__/app-config.js";
import { createLoginCallbackHandler } from "./login-callback-handler.js";
import { parseTokenData as _parseTokenData } from "./parse-token-data.js";
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";

vi.mock("./parse-token-data.js");

const parseTokenData = _parseTokenData as Mock;

describe("createLoginCallbackHandler", async () => {
  let authConfig: any;
  let ctx: any;
  let exchange: Mock;

  beforeEach(() => {
    exchange = vi.fn().mockResolvedValue({ data: true });

    authConfig = {
      defaultTokenExpiry: "1d",
      driver: {
        clientId: "client-id",
        endpoints: vi.fn(),
        exchange,
        subject: vi.fn().mockResolvedValue(null),
      },
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
          format: "jwt",
          claims: { nonce: "nonce" },
        }),
      },
      amphora: {},
      logger: createMockLogger(),
      cookies: {
        get: vi.fn().mockResolvedValue({
          callbackUri: "http://localhost/auth/login/callback",
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
        app: {
          config: createTestAppConfig({ auth: createTestAuthConfig() }),
          environment: "test",
        },
        metadata: { correlationId: "test-correlation" },
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

    expect(exchange).toHaveBeenCalled();

    expect(ctx.session.set).toHaveBeenCalledWith({
      accessToken: "accessToken",
      idToken: "idToken",
      subject: "subject",
    });

    expect(ctx.redirect).toHaveBeenCalledWith("redirectUri");
  });

  test("should resolve with token", async () => {
    ctx.cookies.get.mockResolvedValueOnce({
      callbackUri: "http://localhost/auth/login/callback",
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

  // ⚠ RFC 6749 §4.1.3 — the exchange's `redirect_uri` must be IDENTICAL to the
  // one the authorization request carried. It is computed once, at login, and
  // replayed from the cookie; rebuilding it here is a match nothing enforces.
  test("should replay the callback uri from the cookie, not rebuild it", async () => {
    ctx.cookies.get.mockResolvedValueOnce({
      callbackUri: "https://app.lindorm.io/custom/prefix/login/callback",
      codeChallengeMethod: "S256",
      codeVerifier: "codeVerifier",
      nonce: "nonce",
      redirectUri: "redirectUri",
      responseType: "code",
      scope: "openid profile",
      state: "state",
    });

    await createLoginCallbackHandler(authConfig)(ctx, vi.fn());

    expect(exchange).toHaveBeenCalledWith(expect.any(Object), {
      code: "code",
      codeVerifier: "codeVerifier",
      redirectUri: "https://app.lindorm.io/custom/prefix/login/callback",
      scope: "openid profile",
    });
  });

  test("should resolve the subject through the driver for an opaque token", async () => {
    await createLoginCallbackHandler(authConfig)(ctx, vi.fn());

    const [, , options] = parseTokenData.mock.calls[0];
    await options.resolveSubject("opaque-access-token");

    expect(authConfig.driver.subject).toHaveBeenCalledWith(expect.any(Object), {
      accessToken: "opaque-access-token",
    });
  });

  test("should pass no subject resolver when the driver cannot resolve one", async () => {
    authConfig.driver.subject = undefined;

    await createLoginCallbackHandler(authConfig)(ctx, vi.fn());

    expect(parseTokenData.mock.calls[0][2].resolveSubject).toBeUndefined();
  });

  test("should throw when the driver cannot exchange the code", async () => {
    authConfig.driver.exchange = undefined;

    await expect(createLoginCallbackHandler(authConfig)(ctx, vi.fn())).rejects.toThrow(
      ServerError,
    );
  });

  test("should resolve with nonce verification via aegis verify", async () => {
    await expect(
      createLoginCallbackHandler(authConfig)(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.aegis.verify).toHaveBeenCalledWith("idToken", undefined, {
      critical: [],
    });
  });

  test("forwards the deployment critical declaration to aegis", async () => {
    ctx.state.app.config = createTestAppConfig({
      auth: createTestAuthConfig({ critical: ["objectId"] }),
    });

    await createLoginCallbackHandler(authConfig)(ctx, vi.fn());

    expect(ctx.aegis.verify).toHaveBeenCalledWith("idToken", undefined, {
      critical: ["objectId"],
    });
    expect(parseTokenData).toHaveBeenCalledWith(
      ctx.aegis,
      expect.anything(),
      expect.objectContaining({ critical: ["objectId"] }),
    );
  });

  test("should throw on invalid state", async () => {
    ctx.data.state = "wrong";

    await expect(createLoginCallbackHandler(authConfig)(ctx, vi.fn())).rejects.toThrow(
      ClientError,
    );
  });

  test("should throw on missing session", async () => {
    ctx.cookies.get.mockResolvedValueOnce({
      callbackUri: "http://localhost/auth/login/callback",
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
      expect(exchange).not.toHaveBeenCalled();
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
      format: "jwt",
      claims: { nonce: "wrong_nonce" },
    });

    ctx.cookies.get.mockResolvedValueOnce({
      callbackUri: "http://localhost/auth/login/callback",
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
