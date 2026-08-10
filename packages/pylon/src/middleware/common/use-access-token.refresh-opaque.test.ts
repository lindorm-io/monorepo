import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import {
  ACCESS_TEST_AUDIENCE,
  OPAQUE_TOKEN,
  introspectionAnswer,
  joseShapedToken,
} from "../../__fixtures__/access/tokens.js";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../__fixtures__/app-config.js";
import { useAccessToken } from "./use-access-token.js";

const APP_CONFIG = createTestAppConfig({ auth: createTestAuthConfig() });

const MOUNT = { audience: ACCESS_TEST_AUDIENCE };

const makeCtx = (): any => ({
  aegis: createMockAegis(),
  auth: { introspect: vi.fn() },
  logger: createMockLogger(),
  handshakeId: "hsk-1",
  state: { access: null, app: { config: APP_CONFIG }, tokens: {} },
  io: {
    socket: {
      handshake: {
        auth: { bearer: OPAQUE_TOKEN },
        headers: { host: "api.example.com" },
        secure: true,
        url: "/socket.io/?EIO=4&transport=websocket",
      },
      data: { app: {}, tokens: {}, pylon: {} },
    },
  },
});

/**
 * A socket that authenticated with an OPAQUE credential can refresh onto another
 * one.
 *
 * The refresh handler used to call the structured verify directly, so the one
 * credential kind that cannot be verified locally was also the one kind that
 * could never be refreshed: a connection that handshook perfectly well was
 * dropped the moment its token rotated. It now runs the SAME `resolveAccess`
 * the handshake ran, which is the whole point of the two arms being one
 * function.
 */
describe("useAccessToken — socket refresh on an opaque credential", () => {
  let ctx: any;
  let next: Mock;

  beforeEach(() => {
    next = vi.fn();
    ctx = makeCtx();
  });

  const handshake = async (): Promise<void> => {
    ctx.auth.introspect.mockResolvedValue(introspectionAnswer());
    await useAccessToken(MOUNT)(ctx, next);
  };

  test("the handshake registers a refresh handler for an opaque credential", async () => {
    await handshake();

    expect(ctx.io.socket.data.pylon.access.provenance).toBe("introspected");
    expect(ctx.io.socket.data.pylon.auth.strategy).toBe("bearer");
    // No VerifiedToken exists behind an introspection answer — never synthesise one.
    expect(ctx.io.socket.data.tokens.bearer).toBeUndefined();
  });

  test("a refresh introspects the NEW credential and republishes its access", async () => {
    await handshake();

    ctx.auth.introspect.mockResolvedValue(
      introspectionAnswer({ scope: ["openid", "orders:write"] }),
    );

    await expect(
      ctx.io.socket.data.pylon.auth.refresh({ bearer: "opaque-2", expiresIn: 600 }),
    ).resolves.toBeUndefined();

    expect(ctx.auth.introspect).toHaveBeenLastCalledWith("opaque-2", {
      cache: undefined,
    });
    expect(ctx.io.socket.data.pylon.access.provenance).toBe("introspected");
    expect(ctx.io.socket.data.pylon.access.token).toBe("opaque-2");
    expect(ctx.io.socket.data.pylon.access.claims.scope).toEqual([
      "openid",
      "orders:write",
    ]);
  });

  test("a refresh that changes subject is refused and the connection keeps its access", async () => {
    await handshake();

    ctx.auth.introspect.mockResolvedValue(introspectionAnswer({ subject: "mallory" }));

    await expect(
      ctx.io.socket.data.pylon.auth.refresh({ bearer: "opaque-2", expiresIn: 600 }),
    ).rejects.toMatchObject({ status: 401, code: "refresh_subject_mismatch" });

    expect(ctx.io.socket.data.pylon.access.token).toBe(OPAQUE_TOKEN);
  });

  test("a refresh whose credential fails the mount's matchers is refused", async () => {
    ctx.auth.introspect.mockResolvedValue(
      introspectionAnswer({ permissions: ["users:read"] }),
    );
    await useAccessToken({ ...MOUNT, permissions: ["users:read"] })(ctx, next);

    ctx.auth.introspect.mockResolvedValue(introspectionAnswer({ permissions: [] }));

    await expect(
      ctx.io.socket.data.pylon.auth.refresh({ bearer: "opaque-2", expiresIn: 600 }),
    ).rejects.toMatchObject({ status: 401, code: "access_token_claims_invalid" });
  });

  // A connection that started STRUCTURED and refreshes onto an opaque credential
  // must not go on publishing the replaced token's claims at
  // `ctx.state.tokens.accessToken` beside a fresh `ctx.state.access`.
  test("refreshing onto an opaque credential clears the stale parsed token", async () => {
    const structured = joseShapedToken();
    ctx.io.socket.handshake.auth.bearer = structured;
    (ctx.aegis.verify as Mock).mockResolvedValue({
      claims: {
        issuer: "https://test.lindorm.io/",
        audience: [ACCESS_TEST_AUDIENCE],
        subject: "alice",
      },
      custom: {},
      format: "jwt",
      header: {},
      token: structured,
    });
    await useAccessToken(MOUNT)(ctx, next);

    expect(ctx.io.socket.data.tokens.bearer).toBeDefined();

    ctx.auth.introspect.mockResolvedValue(introspectionAnswer());

    await ctx.io.socket.data.pylon.auth.refresh({ bearer: OPAQUE_TOKEN, expiresIn: 600 });

    expect(ctx.io.socket.data.tokens.bearer).toBeUndefined();
    expect(ctx.io.socket.data.pylon.access.provenance).toBe("introspected");
  });
});
