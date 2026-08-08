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
      set: vi.fn(),
      session: {
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn(),
      },
      state: {
        app: { environment: "test" },
        metadata: { correlationId: "test-correlation" },
        sessionRefreshed: false,
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
    expect(ctx.state.sessionRefreshed).toBe(true);
  });

  // The middleware records WHAT IT DID, never why it ran. `/refresh` synthesises
  // `mode: "force"`, but `force` is also a legitimate configured mode on
  // `/introspect` and `/userinfo` — so an opportunistic refresh is
  // indistinguishable here, and records the same fact because it IS the same
  // fact. The route that cares is what reports it.
  describe("outcome recorded on state", () => {
    test("should record an opportunistic half_life refresh the same way", async () => {
      authConfig.refresh.mode = "half_life";

      await createRefreshMiddleware(authConfig)(ctx, vi.fn());

      expect(ctx.state.sessionRefreshed).toBe(true);
    });

    test("should stay false when the mode says not yet", async () => {
      authConfig.refresh.maxAge = "43201s";
      authConfig.refresh.mode = "max_age";

      await createRefreshMiddleware(authConfig)(ctx, vi.fn());

      expect(ctx.state.sessionRefreshed).toBe(false);
    });

    test("should stay false when the driver implements no refresh method", async () => {
      authConfig.driver.refresh = undefined;

      await createRefreshMiddleware(authConfig)(ctx, vi.fn());

      expect(ctx.state.sessionRefreshed).toBe(false);
    });

    test("should stay false when the session holds no refresh token", async () => {
      delete ctx.state.session.refreshToken;

      await createRefreshMiddleware(authConfig)(ctx, vi.fn());

      expect(ctx.state.sessionRefreshed).toBe(false);
    });

    test("should stay false when the grant fails and the session is deleted", async () => {
      refresh.mockRejectedValue(new Error("invalid_grant"));

      await createRefreshMiddleware(authConfig, { deleteSessionOnFailedGrant: true })(
        ctx,
        vi.fn(),
      );

      expect(ctx.state.sessionRefreshed).toBe(false);
      expect(ctx.state.session).toBeNull();
    });

    test("should stay false when the grant fails and the session is kept", async () => {
      refresh.mockRejectedValue(new Error("invalid_grant"));

      await createRefreshMiddleware(authConfig)(ctx, vi.fn());

      expect(ctx.state.sessionRefreshed).toBe(false);
      expect(ctx.state.session).not.toBeNull();
    });
  });

  // Reported on HEADERS, because this middleware runs on `/refresh`,
  // `/introspect`, `/userinfo` and any mount a deployment adds — and only
  // `/refresh` has a body free to carry it.
  describe("outcome reported on response headers", () => {
    test("should report a refresh and the NEW expiry", async () => {
      const expiresAt = new Date("2024-01-02T08:00:00.000Z");
      parseTokenData.mockResolvedValue({ ...ctx.state.session, expiresAt });

      await createRefreshMiddleware(authConfig)(ctx, vi.fn());

      expect(ctx.set).toHaveBeenCalledWith("X-Pylon-Session-Refreshed", "true");
      expect(ctx.set).toHaveBeenCalledWith(
        "X-Pylon-Session-Expires-At",
        "2024-01-02T08:00:00.000Z",
      );
    });

    test("should report a skip and the ORIGINAL expiry", async () => {
      const { expiresAt } = ctx.state.session;
      delete ctx.state.session.refreshToken;

      await createRefreshMiddleware(authConfig)(ctx, vi.fn());

      expect(ctx.set).toHaveBeenCalledWith("X-Pylon-Session-Refreshed", "false");
      expect(ctx.set).toHaveBeenCalledWith(
        "X-Pylon-Session-Expires-At",
        expiresAt.toISOString(),
      );
    });

    // `false` is still reported: the header is present whenever the middleware
    // ran, so a client reads its ABSENCE as "no refresh middleware here" rather
    // than having to guess between that and "not refreshed".
    test("should report false when the mode says never", async () => {
      authConfig.refresh.mode = "none";

      await createRefreshMiddleware(authConfig)(ctx, vi.fn());

      expect(ctx.set).toHaveBeenCalledWith("X-Pylon-Session-Refreshed", "false");
    });

    // ISO 8601 has no spelling for "no deadline", and inventing one would be a
    // second thing for every client to parse. The pair says it instead:
    // `Refreshed` present, `Expires-At` absent.
    test("should omit the expiry header for a session with no deadline", async () => {
      authConfig.refresh.mode = "none";
      ctx.state.session.expiresAt = null;

      await createRefreshMiddleware(authConfig)(ctx, vi.fn());

      expect(ctx.set).toHaveBeenCalledWith("X-Pylon-Session-Refreshed", "false");
      expect(ctx.set).not.toHaveBeenCalledWith(
        "X-Pylon-Session-Expires-At",
        expect.anything(),
      );
    });

    test("should omit the expiry header when the failed grant destroyed the session", async () => {
      refresh.mockRejectedValue(new Error("invalid_grant"));

      await createRefreshMiddleware(authConfig, { deleteSessionOnFailedGrant: true })(
        ctx,
        vi.fn(),
      );

      expect(ctx.set).toHaveBeenCalledWith("X-Pylon-Session-Refreshed", "false");
      expect(ctx.set).not.toHaveBeenCalledWith(
        "X-Pylon-Session-Expires-At",
        expect.anything(),
      );
    });
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

  // A failed exchange is ambiguous — a spent refresh token and an IdP that was
  // unreachable for two seconds look identical from here. The MOUNT declares
  // which reading is the safe one; the middleware still never learns why it ran.
  describe("a grant that fails", () => {
    beforeEach(() => {
      refresh.mockRejectedValue(new Error("invalid_grant"));
    });

    test("should delete the session when the mount asked for that", async () => {
      await expect(
        createRefreshMiddleware(authConfig, { deleteSessionOnFailedGrant: true })(
          ctx,
          vi.fn(),
        ),
      ).resolves.toBeUndefined();

      expect(ctx.session.del).toHaveBeenCalled();
      expect(ctx.state.session).toBeNull();
      expect(ctx.logger.warn).toHaveBeenCalled();
    });

    // The default. Deleting is destructive and unrecoverable, so it is opt-in:
    // an opportunistic refresh behind `/introspect` or `/userinfo` must not log
    // the user out over a transient failure at the IdP.
    test("should keep the session by default, unchanged", async () => {
      const before = ctx.state.session;

      await expect(
        createRefreshMiddleware(authConfig)(ctx, vi.fn()),
      ).resolves.toBeUndefined();

      expect(ctx.session.del).not.toHaveBeenCalled();
      expect(ctx.session.set).not.toHaveBeenCalled();
      expect(ctx.state.session).toBe(before);
      expect(ctx.state.session.expiresAt).toEqual(before.expiresAt);
      expect(ctx.logger.warn).toHaveBeenCalled();
    });
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
