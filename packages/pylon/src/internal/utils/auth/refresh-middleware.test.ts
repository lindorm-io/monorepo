import { ClientError } from "@lindorm/errors";
import MockDate from "mockdate";
import { parseTokenData as _parseTokenData } from "./parse-token-data.js";
import { createRefreshMiddleware } from "./refresh-middleware.js";
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

vi.mock("./parse-token-data.js");

const parseTokenData = _parseTokenData as Mock;

describe("createRefreshMiddleware", async () => {
  let authConfig: any;
  let ctx: any;

  beforeEach(() => {
    authConfig = {
      refresh: {
        maxAge: "12h",
        mode: "force",
      },
      defaultTokenExpiry: "1d",
    };

    ctx = {
      aegis: {
        verify: vi.fn(),
      },
      auth: {
        token: vi.fn().mockResolvedValue({ data: true }),
      },
      logger: {
        debug: vi.fn(),
        warn: vi.fn(),
      },
      session: {
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn(),
      },
      state: {
        session: {
          id: "a6d36ab7-ab36-52a8-b366-5f5f21f8280e",
          accessToken: "accessToken",
          expiresAt: new Date(Date.now() + 43200 * 1000),
          idToken: "idToken",
          issuedAt: new Date(Date.now() - 43200 * 1000),
          refreshToken: "refreshToken",
          scope: ["scope"],
          subject: "9fb829a7-964e-56a3-9176-809cb357546c",
        },
      },
    };

    parseTokenData.mockResolvedValue("parsedTokenData");
  });

  afterEach(vi.clearAllMocks);

  test("should resolve force", async () => {
    await expect(
      createRefreshMiddleware(authConfig)(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.auth.token).toHaveBeenCalledWith({
      grantType: "refresh_token",
      refreshToken: "refreshToken",
    });
    expect(ctx.session.set).toHaveBeenCalled();
    expect(ctx.session.del).not.toHaveBeenCalled();
    expect(ctx.state.session).toBe("parsedTokenData");
  });

  test("should resolve half_life", async () => {
    authConfig.refresh.mode = "half_life";

    await expect(
      createRefreshMiddleware(authConfig)(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.session.set).toHaveBeenCalled();
  });

  test("should resolve max_age", async () => {
    authConfig.refresh.mode = "max_age";

    await expect(
      createRefreshMiddleware(authConfig)(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.session.set).toHaveBeenCalled();
  });

  test("should not resolve max_age", async () => {
    authConfig.refresh.maxAge = "43201s";
    authConfig.refresh.mode = "max_age";

    await expect(
      createRefreshMiddleware(authConfig)(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.session.set).not.toHaveBeenCalled();
  });

  test("should not resolve none", async () => {
    authConfig.refresh.mode = "none";

    await expect(
      createRefreshMiddleware(authConfig)(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.session.set).not.toHaveBeenCalled();
  });

  test("should keep a session that has no refresh token", async () => {
    // A session established without `offline_access` has no refresh token, and
    // the IdP rejects a refresh_token grant that carries none.
    ctx.auth.token.mockRejectedValue(new Error("invalid_request"));
    delete ctx.state.session.refreshToken;

    await expect(
      createRefreshMiddleware(authConfig)(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.state.session).toEqual(
      expect.objectContaining({ id: "a6d36ab7-ab36-52a8-b366-5f5f21f8280e" }),
    );
    expect(ctx.session.del).not.toHaveBeenCalled();
    expect(ctx.auth.token).not.toHaveBeenCalled();
    expect(ctx.session.set).not.toHaveBeenCalled();
    expect(ctx.logger.debug).toHaveBeenCalled();
  });

  test("should clear the session when a refresh with a refresh token fails", async () => {
    ctx.auth.token.mockRejectedValue(new Error("invalid_grant"));

    await expect(
      createRefreshMiddleware(authConfig)(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.session.del).toHaveBeenCalled();
    expect(ctx.state.session).toBeNull();
  });

  test("should throw on missing session", async () => {
    ctx.state.session = null;

    await expect(createRefreshMiddleware(authConfig)(ctx, vi.fn())).rejects.toThrow(
      ClientError,
    );
  });
});
