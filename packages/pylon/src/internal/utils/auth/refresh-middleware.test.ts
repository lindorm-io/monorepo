import { ClientError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
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
  let refresh: Mock;

  beforeEach(() => {
    refresh = vi.fn().mockResolvedValue({ data: true });

    authConfig = {
      driver: { clientId: "client-id", endpoints: vi.fn(), refresh },
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
      amphora: {},
      logger: createMockLogger(),
      session: {
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn(),
      },
      state: {
        app: { environment: "test" },
        metadata: { correlationId: "test-correlation" },
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

    expect(refresh).toHaveBeenCalledWith(expect.any(Object), {
      refreshToken: "refreshToken",
      scope: null,
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

  // Without an expiry there is no midpoint, so half_life must do nothing. It
  // used to substitute issuedAt for the missing expiry, putting the midpoint in
  // the past on every request — half_life silently behaving as force.
  test("should NOT refresh on half_life when the session has no expiry", async () => {
    authConfig.refresh.mode = "half_life";
    ctx.state.session.expiresAt = null;

    await expect(
      createRefreshMiddleware(authConfig)(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(refresh).not.toHaveBeenCalled();
    expect(ctx.session.set).not.toHaveBeenCalled();
    expect(ctx.state.session).toEqual(
      expect.objectContaining({ id: "a6d36ab7-ab36-52a8-b366-5f5f21f8280e" }),
    );
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
    refresh.mockRejectedValue(new Error("invalid_request"));
    delete ctx.state.session.refreshToken;

    await expect(
      createRefreshMiddleware(authConfig)(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.state.session).toEqual(
      expect.objectContaining({ id: "a6d36ab7-ab36-52a8-b366-5f5f21f8280e" }),
    );
    expect(ctx.session.del).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(ctx.session.set).not.toHaveBeenCalled();
    expect(ctx.logger.debug).toHaveBeenCalled();
  });

  test("should clear the session when a refresh with a refresh token fails", async () => {
    refresh.mockRejectedValue(new Error("invalid_grant"));

    await expect(
      createRefreshMiddleware(authConfig)(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.session.del).toHaveBeenCalled();
    expect(ctx.state.session).toBeNull();
  });

  // Capability wins over policy. A provider with no refresh grant (GitHub
  // classic tokens never expire and cannot be refreshed) says so by omitting the
  // method — there is no `mode: "none"` to also require, and therefore nothing
  // that can disagree with it.
  test("should not refresh when the driver implements no refresh method", async () => {
    authConfig.driver.refresh = undefined;

    await expect(
      createRefreshMiddleware(authConfig)(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.session.set).not.toHaveBeenCalled();
    expect(ctx.session.del).not.toHaveBeenCalled();
  });

  test("should throw on missing session", async () => {
    ctx.state.session = null;

    await expect(createRefreshMiddleware(authConfig)(ctx, vi.fn())).rejects.toThrow(
      ClientError,
    );
  });
});
