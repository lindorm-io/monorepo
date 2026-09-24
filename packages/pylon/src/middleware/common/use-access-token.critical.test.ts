import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test, vi } from "vitest";
import {
  ACCESS_TEST_ISSUER,
  createTestAegis,
  mintTestAccessToken,
} from "../../__fixtures__/access/aegis.js";
import { ACCESS_TEST_AUDIENCE } from "../../__fixtures__/access/tokens.js";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../__fixtures__/app-config.js";
import { createTestPylonCtx } from "../../mocks/vitest.js";
import { createTokenMiddleware } from "./create-token-middleware.js";
import { useAccessToken } from "./use-access-token.js";

/**
 * The deployment-level `critical` declaration, measured at the public door with
 * a REAL aegis over real keys — a mock cannot refuse a `crit`, so only a real
 * key proves the declaration travelled all the way down.
 */
describe("useAccessToken critical declaration", () => {
  const critToken = (aegis: ReturnType<typeof createTestAegis>): Promise<string> =>
    mintTestAccessToken(
      aegis,
      {},
      { sign: { header: { critical: ["objectId"], objectId: "1.2.3.4" } } },
    );

  const buildCtx = async (
    critical: Array<string> | undefined,
    token: string,
  ): Promise<any> => {
    const aegis = createTestAegis(createMockLogger());

    return await createTestPylonCtx({
      aegis,
      state: {
        app: {
          config: {
            auth: createTestAuthConfig({
              issuer: ACCESS_TEST_ISSUER,
              ...(critical && { critical }),
            }),
          },
        },
        authorization: { type: "bearer", value: token },
      },
    });
  };

  test("a token whose crit names a declared parameter verifies through useAccessToken", async () => {
    const aegis = createTestAegis(createMockLogger());
    const ctx = await buildCtx(["objectId"], await critToken(aegis));
    ctx.aegis = aegis;
    const next = vi.fn();

    await expect(
      useAccessToken({ audience: ACCESS_TEST_AUDIENCE })(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.state.access?.provenance).toBe("verified");
    expect(ctx.state.tokens.accessToken?.header.critical).toEqual(["objectId"]);
    expect(ctx.state.tokens.accessToken?.header.objectId).toBe("1.2.3.4");
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("an undeclared critical parameter is refused with aegis's own code", async () => {
    const aegis = createTestAegis(createMockLogger());
    const ctx = await buildCtx(undefined, await critToken(aegis));
    ctx.aegis = aegis;
    const next = vi.fn();

    // The cause is DESTRUCTURED into the wrapper, not attached: `LindormError`
    // keeps the wrapper's own `code` and folds the aegis refusal into `data`
    // (the refused wire parameter) and the `errors` string list.
    await expect(
      useAccessToken({ audience: ACCESS_TEST_AUDIENCE })(ctx, next),
    ).rejects.toMatchObject({
      status: 401,
      code: "access_token_verification_failed",
      data: { param: "oid" },
      errors: [expect.stringContaining("Unsupported critical header parameter")],
    });

    expect(next).not.toHaveBeenCalled();
  });

  test("omitting the setting refuses every critical parameter", async () => {
    const aegis = createTestAegis(createMockLogger());
    // `createTestAuthConfig()` default: an auth block naming no `critical`.
    const ctx = await buildCtx(undefined, await critToken(aegis));
    ctx.aegis = aegis;
    const next = vi.fn();

    await expect(
      useAccessToken({ audience: ACCESS_TEST_AUDIENCE })(ctx, next),
    ).rejects.toMatchObject({ status: 401, code: "access_token_verification_failed" });
  });

  test("a route cannot widen the deployment's declaration", async () => {
    const aegis = createTestAegis(createMockLogger());
    const token = await critToken(aegis);

    // (a) createTokenMiddleware: the cast-in `critical` is discarded — the
    // deployment declared nothing, so the crit-bearing token is refused.
    const middlewareCtx = await buildCtx(undefined, token);
    middlewareCtx.aegis = aegis;
    middlewareCtx.data = { token };

    await expect(
      createTokenMiddleware({
        contextKey: "accessToken",
        issuer: ACCESS_TEST_ISSUER,
        critical: ["objectId"],
      } as any)("data.token")(middlewareCtx, vi.fn()),
    ).rejects.toMatchObject({ status: 401, code: "token_verification_failed" });

    // (b) useAccessToken: the cast-in `critical` lands in the matcher bag and
    // the crit-bearing token must NOT verify.
    const mountCtx = await buildCtx(undefined, token);
    mountCtx.aegis = aegis;
    const next = vi.fn();

    await expect(
      useAccessToken({
        audience: ACCESS_TEST_AUDIENCE,
        critical: ["objectId"],
      } as any)(mountCtx, next),
    ).rejects.toMatchObject({ status: 401 });

    expect(next).not.toHaveBeenCalled();
  });
});

/**
 * The declaration reaches the SESSION arms too — the two obtain layers that go
 * through `extractTokenFromSession` rather than `resolveAccess`. Each is its own
 * threading site, so each takes its own public-door pin: a one-line revert at
 * either site leaves every bearer-arm test green.
 */
describe("useAccessToken critical declaration — cookie-session arm", () => {
  const appConfig = (critical?: Array<string>) =>
    createTestAppConfig({
      auth: createTestAuthConfig({
        issuer: ACCESS_TEST_ISSUER,
        ...(critical && { critical }),
      }),
    });

  const buildSessionCtx = (
    aegis: ReturnType<typeof createTestAegis>,
    critical: Array<string> | undefined,
    accessToken: string,
  ): any => ({
    aegis,
    auth: { introspect: vi.fn() },
    get: vi.fn(() => undefined),
    logger: createMockLogger(),
    method: "GET",
    origin: "https://api.example.com",
    path: "/resource",
    request: {},
    state: {
      access: null,
      app: { config: appConfig(critical) },
      authorization: { type: "none", value: null },
      session: {
        id: "sess-1",
        accessToken,
        expiresAt: new Date("2999-01-01T00:00:00.000Z"),
        issuedAt: new Date(),
        scope: ["openid"],
        subject: "alice",
      },
      tokens: {},
    },
  });

  test("a token whose crit names a declared parameter verifies through the cookie-session arm", async () => {
    const aegis = createTestAegis(createMockLogger());
    const token = await mintTestAccessToken(
      aegis,
      {},
      { sign: { header: { critical: ["objectId"], objectId: "1.2.3.4" } } },
    );
    const ctx = buildSessionCtx(aegis, ["objectId"], token);
    const next = vi.fn();

    await expect(
      useAccessToken({ audience: ACCESS_TEST_AUDIENCE })(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.state.access?.provenance).toBe("verified");
    expect(ctx.state.tokens.accessToken?.header.objectId).toBe("1.2.3.4");
    expect(next).toHaveBeenCalledTimes(1);
  });

  // The swallow shape, not the bearer arm's: `extractTokenFromSession` folds the
  // aegis refusal into "no parse", so the deployment that declares nothing sees
  // an unreadable session credential.
  test("an undeclared critical parameter leaves the session credential unreadable", async () => {
    const aegis = createTestAegis(createMockLogger());
    const token = await mintTestAccessToken(
      aegis,
      {},
      { sign: { header: { critical: ["objectId"], objectId: "1.2.3.4" } } },
    );
    const ctx = buildSessionCtx(aegis, undefined, token);
    const next = vi.fn();

    await expect(
      useAccessToken({ audience: ACCESS_TEST_AUDIENCE })(ctx, next),
    ).rejects.toMatchObject({ status: 401, code: "invalid_session_access_token" });

    expect(ctx.state.access).toBeNull();
    expect(ctx.state.tokens.accessToken).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });
});

describe("useAccessToken critical declaration — socket handshake session arm", () => {
  const buildHandshakeCtx = (
    aegis: ReturnType<typeof createTestAegis>,
    critical: Array<string> | undefined,
    accessToken: string,
  ): any => ({
    aegis,
    auth: { introspect: vi.fn() },
    logger: createMockLogger(),
    handshakeId: "hsk-1",
    state: {
      access: null,
      app: {
        config: createTestAppConfig({
          auth: createTestAuthConfig({
            issuer: ACCESS_TEST_ISSUER,
            ...(critical && { critical }),
          }),
        }),
      },
      tokens: {},
    },
    io: {
      socket: {
        handshake: {
          auth: {},
          headers: { host: "api.example.com" },
          secure: true,
          url: "/socket.io/?EIO=4&transport=websocket",
        },
        data: {
          app: {},
          tokens: {},
          pylon: {},
          session: {
            id: "sess-1",
            accessToken,
            expiresAt: new Date("2999-01-01T00:00:00.000Z"),
            issuedAt: new Date(),
            scope: ["openid"],
            subject: "alice",
          },
        },
      },
    },
  });

  test("a token whose crit names a declared parameter verifies through the handshake session arm", async () => {
    const aegis = createTestAegis(createMockLogger());
    const token = await mintTestAccessToken(
      aegis,
      {},
      { sign: { header: { critical: ["objectId"], objectId: "1.2.3.4" } } },
    );
    const ctx = buildHandshakeCtx(aegis, ["objectId"], token);
    const next = vi.fn();

    await expect(
      useAccessToken({ audience: ACCESS_TEST_AUDIENCE })(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.io.socket.data.pylon.access?.provenance).toBe("verified");
    expect(ctx.io.socket.data.tokens.bearer?.header.objectId).toBe("1.2.3.4");
    expect(ctx.io.socket.data.pylon.auth.strategy).toBe("session");
    expect(next).toHaveBeenCalledTimes(1);
  });

  // The refresh handler is its own threading member (`critical` handed to
  // `createSessionRefreshHandler`), so the install-time pin above does not
  // cover it: the refresh must republish the crit-bearing token, which only
  // happens when its OWN verify carries the declaration.
  test("the handshake's refresh handler re-verifies under the deployment's declaration", async () => {
    const aegis = createTestAegis(createMockLogger());
    const token = await mintTestAccessToken(
      aegis,
      {},
      { sign: { header: { critical: ["objectId"], objectId: "1.2.3.4" } } },
    );
    const ctx = buildHandshakeCtx(aegis, ["objectId"], token);

    await useAccessToken({ audience: ACCESS_TEST_AUDIENCE })(ctx, vi.fn());
    const installed = ctx.io.socket.data.tokens.bearer;
    expect(installed?.header.objectId).toBe("1.2.3.4");

    await ctx.io.socket.data.pylon.auth.refresh({});

    expect(ctx.io.socket.data.tokens.bearer).not.toBe(installed);
    expect(ctx.io.socket.data.tokens.bearer?.header.objectId).toBe("1.2.3.4");
  });

  // The handshake's swallow shape: no throw — the strategy registers with no
  // resolved access, and the socket fails `missing_handshake_access` later.
  test("an undeclared critical parameter leaves the handshake session credential unparsed", async () => {
    const aegis = createTestAegis(createMockLogger());
    const token = await mintTestAccessToken(
      aegis,
      {},
      { sign: { header: { critical: ["objectId"], objectId: "1.2.3.4" } } },
    );
    const ctx = buildHandshakeCtx(aegis, undefined, token);
    const next = vi.fn();

    await expect(
      useAccessToken({ audience: ACCESS_TEST_AUDIENCE })(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.io.socket.data.pylon.auth.strategy).toBe("session");
    expect(ctx.io.socket.data.pylon.access).toBeUndefined();
    expect(ctx.io.socket.data.tokens.bearer).toBeUndefined();
  });
});
