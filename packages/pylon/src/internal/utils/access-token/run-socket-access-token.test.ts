import { beforeEach, describe, expect, test, vi } from "vitest";
import type { PylonResolvedAccess } from "../../../types/index.js";
import { runSocketAccessToken } from "./run-socket-access-token.js";

const FUTURE = new Date("2099-01-01T00:00:00.000Z");

/**
 * The socket EVENT fast path. It republishes what the handshake resolved and
 * re-checks EXPIRY, not the signature.
 *
 * ⚠ It reads `socket.data.pylon.access`, not `socket.data.tokens.bearer`. It
 * used to rebuild the access shape from the parsed token — which an OPAQUE
 * credential does not have, so an opaque connection would have thrown a
 * TypeError on its first event even once the handshake could resolve one.
 */
describe("runSocketAccessToken", () => {
  const makeCtx = (overrides: any = {}): any => {
    const bearer = {
      claims: { subject: "alice" },
      custom: {},
      format: "jwt",
      token: "socket-jwt",
    };
    const access: PylonResolvedAccess = {
      provenance: "verified",
      claims: bearer.claims,
      custom: bearer.custom,
      token: bearer.token,
    };

    return {
      state: { access: null, tokens: {} },
      io: {
        socket: {
          emit: vi.fn(),
          data: {
            tokens: { bearer },
            pylon: {
              access,
              auth: {
                strategy: "bearer",
                getExpiresAt: () => FUTURE,
                refresh: async () => {},
                authExpiredEmittedAt: null,
              },
            },
            ...overrides.data,
          },
        },
      },
    };
  };

  let ctx: any;

  beforeEach(() => {
    ctx = makeCtx();
  });

  test("republishes the handshake's resolved access", () => {
    const result = runSocketAccessToken(ctx);

    expect(ctx.state.access).toBe(ctx.io.socket.data.pylon.access);
    expect(ctx.state.tokens.accessToken).toBe(ctx.io.socket.data.tokens.bearer);
    expect(result).toEqual({ expiresAt: FUTURE, strategy: "bearer" });
  });

  // The bug-3 counterpart on the event path: an opaque connection has NO parsed
  // token, and must still serve its events.
  test("serves an INTROSPECTED connection that has no parsed token", () => {
    ctx.io.socket.data.tokens = {};
    ctx.io.socket.data.pylon.access = {
      provenance: "introspected",
      claims: { subject: "alice" },
      custom: {},
      token: "opaque-handle",
    };

    const result = runSocketAccessToken(ctx);

    expect(ctx.state.access.provenance).toBe("introspected");
    // Never synthesise a VerifiedToken that does not exist.
    expect(ctx.state.tokens.accessToken).toBeUndefined();
    expect(result.strategy).toBe("bearer");
  });

  test("carries the handshake's provenance forward rather than asserting one", () => {
    ctx.io.socket.data.pylon.access = {
      provenance: "introspected",
      claims: { subject: "alice" },
      custom: {},
      token: "opaque-handle",
    };

    runSocketAccessToken(ctx);

    expect(ctx.state.access.provenance).toBe("introspected");
  });

  test("throws by name when the handshake registered no auth", () => {
    ctx.io.socket.data.pylon = {};

    expect(() => runSocketAccessToken(ctx)).toThrow(
      expect.objectContaining({ code: "missing_handshake_auth_state", status: 401 }),
    );
  });

  // A registered auth with no access is not reachable through the middleware,
  // but a hand-rolled connection middleware could produce it — say so by name
  // rather than dereferencing null.
  test("throws by name when auth exists but no access was resolved", () => {
    delete ctx.io.socket.data.pylon.access;

    expect(() => runSocketAccessToken(ctx)).toThrow(
      expect.objectContaining({ code: "missing_handshake_access", status: 401 }),
    );
  });

  test("throws when the credential has expired", () => {
    ctx.io.socket.data.pylon.auth.getExpiresAt = () => new Date(Date.now() - 1_000);

    expect(() => runSocketAccessToken(ctx)).toThrow(
      expect.objectContaining({ code: "access_token_expired", status: 401 }),
    );
    expect(ctx.state.access).toBeNull();
  });

  test("emits the expiry warning once inside the window", () => {
    const soon = new Date(Date.now() + 30_000);
    ctx.io.socket.data.pylon.auth.getExpiresAt = () => soon;

    runSocketAccessToken(ctx);
    expect(ctx.io.socket.emit).toHaveBeenCalledWith("$pylon/auth/expired", {
      expiresAt: soon,
    });

    ctx.io.socket.emit.mockClear();
    runSocketAccessToken(ctx);
    expect(ctx.io.socket.emit).not.toHaveBeenCalled();
  });
});
