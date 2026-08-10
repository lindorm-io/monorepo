import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import { ClientError } from "@lindorm/errors";
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import {
  ACCESS_TEST_APP_ISSUER,
  ACCESS_TEST_AUDIENCE,
  OPAQUE_TOKEN,
  accessClaims,
  introspectionAnswer,
  joseShapedToken,
  verifiedAccess,
} from "../../../__fixtures__/access/tokens.js";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../../__fixtures__/app-config.js";
import type { AccessTokenMatchers, PylonSocketAuth } from "../../../types/index.js";
import { createBearerRefreshHandler } from "./create-bearer-refresh-handler.js";

/**
 * ⚠ The refreshed credential is a real JOSE-shaped token, not the string
 * `"new-jwt"` it used to be. The handler now routes through `resolveAccess`,
 * which SNIFFS the wire: a bare handle would take the introspected arm, so a
 * suite meaning to exercise local verification has to present something the
 * sniff actually accepts.
 */
const NEW_TOKEN = joseShapedToken();

const MATCHERS: AccessTokenMatchers = { audience: ACCESS_TEST_AUDIENCE };

describe("createBearerRefreshHandler", () => {
  let auth: PylonSocketAuth;
  let ctx: any;
  let socket: any;

  const handler = (overrides: Record<string, unknown> = {}) =>
    createBearerRefreshHandler({
      cache: undefined,
      ctx,
      issuer: ACCESS_TEST_APP_ISSUER,
      matchers: MATCHERS,
      profile: "access_token" as const,
      socket,
      subject: "alice",
      ...overrides,
    } as any);

  beforeEach(() => {
    vi.useFakeTimers().setSystemTime(new Date("2026-04-11T12:00:00.000Z"));

    // The HANDSHAKE context, captured whole — the opaque arm needs the auth
    // driver and the resolved app config, not just `ctx.aegis`.
    ctx = {
      aegis: createMockAegis(),
      auth: { introspect: vi.fn() },
      state: { app: { config: createTestAppConfig({ auth: createTestAuthConfig() }) } },
    };

    auth = {
      strategy: "bearer",
      getExpiresAt: () => new Date("2026-04-11T12:05:00.000Z"),
      refresh: async () => {},
      authExpiredEmittedAt: new Date("2026-04-11T12:04:30.000Z"),
    };

    socket = {
      data: {
        tokens: { bearer: { claims: { subject: "alice" } } },
        pylon: { auth },
      },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("swaps bearer, updates getExpiresAt from expiresIn, clears authExpiredEmittedAt on valid refresh", async () => {
    (ctx.aegis.verify as Mock).mockResolvedValue(
      verifiedAccess(
        { subject: "alice", expiresAt: new Date("2026-04-11T13:30:00.000Z") },
        NEW_TOKEN,
      ),
    );

    await handler()({ bearer: NEW_TOKEN, expiresIn: 3600 });

    expect(socket.data.tokens.bearer).toMatchSnapshot();
    expect(socket.data.pylon.access.provenance).toBe("verified");
    expect(auth.getExpiresAt()).toEqual(new Date("2026-04-11T13:00:00.000Z"));
    expect(auth.authExpiredEmittedAt).toBeNull();
  });

  test("envelope expiresIn wins over parsed token exp", async () => {
    (ctx.aegis.verify as Mock).mockResolvedValue(
      verifiedAccess(
        { subject: "alice", expiresAt: new Date("2026-04-11T23:59:59.000Z") },
        NEW_TOKEN,
      ),
    );

    await handler()({ bearer: NEW_TOKEN, expiresIn: 300 });

    expect(auth.getExpiresAt()).toEqual(new Date("2026-04-11T12:05:00.000Z"));
  });

  test("throws when subject changes", async () => {
    (ctx.aegis.verify as Mock).mockResolvedValue(
      verifiedAccess({ subject: "bob", expiresAt: new Date() }, NEW_TOKEN),
    );

    await expect(handler()({ bearer: NEW_TOKEN, expiresIn: 3600 })).rejects.toThrow(
      ClientError,
    );
  });

  // The mount's matchers are re-applied on every refresh, so a rotated
  // credential cannot widen the grant the handshake was accepted under.
  test("throws when the refreshed credential is for another audience", async () => {
    (ctx.aegis.verify as Mock).mockResolvedValue(
      verifiedAccess(
        { subject: "alice", audience: ["https://elsewhere.test"] },
        NEW_TOKEN,
      ),
    );

    await expect(handler()({ bearer: NEW_TOKEN, expiresIn: 3600 })).rejects.toThrow(
      expect.objectContaining({ code: "access_token_claims_invalid" }),
    );
  });

  /**
   * The arm that used to be unreachable here. The handler called the structured
   * verify directly, so a connection established with an OPAQUE credential was
   * dropped the moment its token rotated — the one credential kind that cannot
   * be re-verified locally was the one kind that could never be refreshed.
   */
  describe("opaque arm", () => {
    beforeEach(() => {
      ctx.auth.introspect.mockResolvedValue(introspectionAnswer({ subject: "alice" }));
    });

    test("refreshes onto an introspected credential", async () => {
      await handler()({ bearer: OPAQUE_TOKEN, expiresIn: 3600 });

      expect(ctx.aegis.verify).not.toHaveBeenCalled();
      expect(socket.data.pylon.access).toEqual({
        provenance: "introspected",
        claims: accessClaims({ subject: "alice" }),
        custom: {},
        token: OPAQUE_TOKEN,
      });
    });

    // CLEARED, not left alone: there is no VerifiedToken behind an introspection
    // answer, so a socket that refreshed from a structured token onto an opaque
    // one would otherwise keep publishing the REPLACED token's claims at
    // `ctx.state.tokens.accessToken` beside a fresh `ctx.state.access`.
    test("clears the socket's bearer token", async () => {
      await handler()({ bearer: OPAQUE_TOKEN, expiresIn: 3600 });

      expect(socket.data.tokens.bearer).toBeUndefined();
      expect("bearer" in socket.data.tokens).toBe(false);
    });

    test("still enforces the subject", async () => {
      ctx.auth.introspect.mockResolvedValue(introspectionAnswer({ subject: "bob" }));

      await expect(handler()({ bearer: OPAQUE_TOKEN, expiresIn: 3600 })).rejects.toThrow(
        ClientError,
      );
    });
  });

  describe("capturedJkt (DPoP binding)", () => {
    test("accepts refresh when new token has same cnf.jkt", async () => {
      (ctx.aegis.verify as Mock).mockResolvedValue(
        verifiedAccess(
          {
            subject: "alice",
            expiresAt: new Date("2026-04-11T13:00:00.000Z"),
            confirmation: { thumbprint: "jkt-abc" },
          },
          NEW_TOKEN,
        ),
      );

      await expect(
        handler({ capturedJkt: "jkt-abc" })({ bearer: NEW_TOKEN, expiresIn: 3600 }),
      ).resolves.toBeUndefined();
      expect(socket.data.tokens.bearer).toMatchSnapshot();
    });

    test("rejects refresh when new token has a different cnf.jkt", async () => {
      (ctx.aegis.verify as Mock).mockResolvedValue(
        verifiedAccess(
          {
            subject: "alice",
            expiresAt: new Date(),
            confirmation: { thumbprint: "jkt-xyz" },
          },
          NEW_TOKEN,
        ),
      );

      await expect(
        handler({ capturedJkt: "jkt-abc" })({ bearer: NEW_TOKEN, expiresIn: 3600 }),
      ).rejects.toThrow(ClientError);
    });

    test("rejects refresh when new token is bearer-only (no cnf.jkt)", async () => {
      (ctx.aegis.verify as Mock).mockResolvedValue(
        verifiedAccess({ subject: "alice", expiresAt: new Date() }, NEW_TOKEN),
      );

      await expect(
        handler({ capturedJkt: "jkt-abc" })({ bearer: NEW_TOKEN, expiresIn: 3600 }),
      ).rejects.toThrow(ClientError);
    });

    // The binding travels with the RESOLUTION (RFC 9449 §6.2), not with a
    // locally verified artifact — so an introspected credential is held to the
    // captured thumbprint exactly like a verified one.
    test("rejects an introspected refresh that drops the binding", async () => {
      ctx.auth.introspect.mockResolvedValue(introspectionAnswer({ subject: "alice" }));

      await expect(
        handler({ capturedJkt: "jkt-abc" })({ bearer: OPAQUE_TOKEN, expiresIn: 3600 }),
      ).rejects.toThrow(ClientError);
    });
  });

  test("throws when payload is malformed", async () => {
    const refresh = handler();

    await expect(refresh({})).rejects.toThrow(ClientError);
    await expect(refresh(null)).rejects.toThrow(ClientError);
    await expect(refresh({ bearer: 123, expiresIn: 3600 })).rejects.toThrow(ClientError);
    await expect(refresh({ bearer: NEW_TOKEN })).rejects.toThrow(ClientError);
    await expect(refresh({ bearer: NEW_TOKEN, expiresIn: "3600" })).rejects.toThrow(
      ClientError,
    );
    await expect(refresh({ bearer: NEW_TOKEN, expiresIn: 0 })).rejects.toThrow(
      ClientError,
    );
    await expect(refresh({ bearer: NEW_TOKEN, expiresIn: -1 })).rejects.toThrow(
      ClientError,
    );
  });
});
