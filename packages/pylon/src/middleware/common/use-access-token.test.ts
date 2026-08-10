import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import { ClientError, ServerError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import {
  ACCESS_MOUNT,
  OPAQUE_TOKEN,
  accessClaims,
  introspectionAnswer,
  joseShapedToken,
  verifiedAccess,
} from "../../__fixtures__/access/tokens.js";
import { useAccessToken } from "./use-access-token.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../__fixtures__/app-config.js";

/** Auth configured with a driver that CAN introspect — the ordinary resource
 *  server, so the opaque arm is reachable. */
const APP_CONFIG = createTestAppConfig({ auth: createTestAuthConfig() });

describe("useAccessToken", () => {
  let next: Mock;

  beforeEach(() => {
    next = vi.fn();
  });

  describe("HTTP context", () => {
    let ctx: any;

    beforeEach(() => {
      ctx = {
        aegis: createMockAegis(),
        auth: { introspect: vi.fn() },
        logger: createMockLogger(),
        request: {},
        state: {
          access: null,
          app: { config: APP_CONFIG },
          authorization: { type: "bearer", value: joseShapedToken() },
          session: null,
          tokens: {},
        },
      };
    });

    test("verifies a JOSE bearer token and resolves verified access", async () => {
      // ⚠ The mock's DEFAULT answer (`{ subject: "verified_subject" }`, no issuer,
      // no audience) no longer clears the shared assert — the issuer predicate is
      // a hard `$eq` and the mount's audience applies on both arms — so a
      // structured answer has to state the claim floor it is supposed to clear.
      (ctx.aegis.verify as Mock).mockResolvedValue(verifiedAccess());

      const middleware = useAccessToken(ACCESS_MOUNT);

      await expect(middleware(ctx, next)).resolves.toBeUndefined();

      // Asserted through what the middleware RESOLVED, not through the shape of
      // the call it made: the call shape is `verifyAccessToken`'s own subject, and
      // a test that only pins arguments passes while the resolution silently
      // changes underneath it.
      expect(ctx.auth.introspect).not.toHaveBeenCalled();
      expect(ctx.state.access.provenance).toBe("verified");
      expect(ctx.state.tokens.accessToken).toMatchSnapshot();
      expect(ctx.state.access).toMatchSnapshot();
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("introspects an OPAQUE bearer token and resolves introspected access", async () => {
      ctx.state.authorization = { type: "bearer", value: OPAQUE_TOKEN };
      ctx.auth.introspect.mockResolvedValue(
        introspectionAnswer({ scope: ["openid"], permissions: ["users:read"] }),
      );

      const middleware = useAccessToken(ACCESS_MOUNT);

      await expect(middleware(ctx, next)).resolves.toBeUndefined();

      expect(ctx.aegis.verify).not.toHaveBeenCalled();
      expect(ctx.auth.introspect).toHaveBeenCalledWith(OPAQUE_TOKEN, {
        cache: undefined,
      });
      // No VerifiedToken exists on this path — never synthesise one.
      expect(ctx.state.tokens.accessToken).toBeUndefined();
      expect(ctx.state.access).toMatchSnapshot();
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("both provenances resolve the same claim shape", async () => {
      const extra = { scope: ["openid"], permissions: ["users:read"] };

      (ctx.aegis.verify as Mock).mockResolvedValue(verifiedAccess(extra));
      await useAccessToken(ACCESS_MOUNT)(ctx, next);
      const verified = ctx.state.access;

      ctx.state.access = null;
      ctx.state.tokens = {};
      ctx.state.authorization = { type: "bearer", value: OPAQUE_TOKEN };
      ctx.auth.introspect.mockResolvedValue(introspectionAnswer(extra));
      await useAccessToken(ACCESS_MOUNT)(ctx, next);
      const introspected = ctx.state.access;

      expect(verified.provenance).toBe("verified");
      expect(introspected.provenance).toBe("introspected");
      // `active`/`tokenType` describe the ANSWER and are stripped, so what is left
      // is claim-for-claim what the structured arm produced.
      expect(introspected.claims).toEqual(verified.claims);
    });

    test("throws 401 when introspection reports the token is not active", async () => {
      ctx.state.authorization = { type: "bearer", value: OPAQUE_TOKEN };
      ctx.auth.introspect.mockResolvedValue({ active: false });

      const middleware = useAccessToken(ACCESS_MOUNT);

      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);

      try {
        await middleware(ctx, next);
        expect.fail("Expected error to be thrown");
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.code).toBe("token_not_active");
      }
      expect(ctx.state.access).toBeNull();
      expect(next).not.toHaveBeenCalled();
    });

    // RFC 7662 §2.2 `token_type` is now asserted PRESENT on the introspected arm:
    // the structured arm can never produce a credential whose type went unstated
    // (the profile floor matches the JOSE `typ`), so an answer of bare
    // `{ active: true }` must not be the one shape that slips past.
    test("throws 401 when an active answer declares no token_type", async () => {
      ctx.state.authorization = { type: "bearer", value: OPAQUE_TOKEN };
      ctx.auth.introspect.mockResolvedValue({
        ...introspectionAnswer(),
        tokenType: undefined,
      });

      await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).rejects.toMatchObject({
        status: 401,
        code: "introspection_token_type_missing",
      });
      expect(ctx.state.access).toBeNull();
      expect(next).not.toHaveBeenCalled();
    });

    test("falls back to session.accessToken when no header present", async () => {
      ctx.state.authorization = { type: "none", value: null };
      ctx.state.session = {
        id: "sess-1",
        accessToken: "session-jwt",
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        issuedAt: new Date(),
        scope: ["openid"],
        subject: "alice",
      };
      // The cookie-session arm answers to the SAME assert as the header arms now,
      // so the session's own access token has to clear the same claim floor.
      (ctx.aegis.verify as Mock).mockResolvedValue({
        claims: accessClaims(),
        custom: {},
        format: "jwt",
        token: "session-jwt",
      });

      const middleware = useAccessToken(ACCESS_MOUNT);
      await middleware(ctx, next);

      // The credential came from the session, not a header: `authorization` is
      // `none`, and the resolved token is the session's stored one.
      expect(ctx.state.access.token).toBe("session-jwt");
      expect(ctx.state.tokens.accessToken).toMatchSnapshot();
      expect(ctx.state.access).toMatchSnapshot();
      expect(next).toHaveBeenCalledTimes(1);
    });

    // ⚠ NEW REFUSAL, covered elsewhere. The cookie-session arm now runs the same
    // `assertDpopBinding` the header arms do, with no proof, so a DPoP-bound
    // token (RFC 9449 §7.1) is no longer served as a plain bearer just because it
    // arrived in a cookie. It is proved against a REAL Aegis — a real signature
    // over a real `cnf.jkt` — in `use-access-token.session.test.ts`, rather than
    // here where the claims come from a mock.
    test("prefers header over session when both present", async () => {
      ctx.state.session = {
        id: "sess-1",
        accessToken: "session-jwt",
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        issuedAt: new Date(),
        scope: ["openid"],
        subject: "alice",
      };
      (ctx.aegis.verify as Mock).mockResolvedValue(verifiedAccess());

      const middleware = useAccessToken(ACCESS_MOUNT);
      await middleware(ctx, next);

      // The resolved credential is the HEADER token — the session's would have
      // resolved as `"session-jwt"`.
      expect(ctx.state.access.token).toBe(joseShapedToken());
      expect(ctx.state.access.provenance).toBe("verified");
    });

    test("throws Unauthorized when neither header nor session present", async () => {
      ctx.state.authorization = { type: "none", value: null };

      const middleware = useAccessToken(ACCESS_MOUNT);
      await expect(middleware(ctx, next)).rejects.toMatchObject({
        status: 401,
        code: "missing_credentials",
      });
    });

    test("throws Unauthorized when session accessToken cannot be parsed", async () => {
      ctx.state.authorization = { type: "none", value: null };
      ctx.state.session = {
        id: "sess-1",
        accessToken: "bad",
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        issuedAt: new Date(),
        scope: ["openid"],
        subject: "alice",
      };
      const { AegisError } =
        await vi.importActual<typeof import("@lindorm/aegis")>("@lindorm/aegis");
      (ctx.aegis.verify as Mock).mockRejectedValue(new AegisError("bad token"));

      const middleware = useAccessToken(ACCESS_MOUNT);
      await expect(middleware(ctx, next)).rejects.toMatchObject({
        status: 401,
        code: "invalid_session_access_token",
      });
    });
  });

  describe("Socket event fast path", () => {
    const makeCtx = (authOverride: any = {}): any => {
      const parsedBearer = {
        claims: { subject: "alice" },
        custom: {},
        format: "jwt",
        token: "socket-jwt",
      };
      // What the handshake arm leaves behind. The fast path republishes THIS
      // rather than rebuilding an access shape from the parsed token, because an
      // opaque credential produces no parsed token at all.
      const handshakeAccess = {
        provenance: "verified" as const,
        claims: parsedBearer.claims,
        custom: parsedBearer.custom,
        token: parsedBearer.token,
      };
      return {
        aegis: createMockAegis(),
        auth: { introspect: vi.fn() },
        logger: createMockLogger(),
        event: "some:event",
        state: { access: null, app: { config: APP_CONFIG }, tokens: {} },
        io: {
          socket: {
            data: {
              tokens: { bearer: parsedBearer },
              pylon: {
                access: handshakeAccess,
                auth: {
                  strategy: "bearer",
                  getExpiresAt: () => new Date("2099-01-01T00:00:00.000Z"),
                  refresh: async () => {},
                  authExpiredEmittedAt: null,
                  ...authOverride,
                },
              },
            },
            emit: vi.fn(),
          },
        },
      };
    };

    test("accepts silently when well before expiry warning window", async () => {
      const ctx = makeCtx();
      const middleware = useAccessToken(ACCESS_MOUNT);

      await middleware(ctx, next);

      expect(ctx.io.socket.emit).not.toHaveBeenCalled();
      expect(ctx.aegis.verify).not.toHaveBeenCalled();
      expect(ctx.state.tokens.accessToken).toBe(ctx.io.socket.data.tokens.bearer);
      expect(ctx.state.access).toMatchSnapshot();
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("emits $pylon/auth/expired exactly once inside the warning window", async () => {
      const soon = new Date(Date.now() + 30_000);
      const ctx = makeCtx({ getExpiresAt: () => soon });
      const middleware = useAccessToken(ACCESS_MOUNT);

      await middleware(ctx, next);

      expect(ctx.io.socket.emit).toHaveBeenCalledWith("$pylon/auth/expired", {
        expiresAt: soon,
      });
      expect(ctx.io.socket.data.pylon.auth.authExpiredEmittedAt).not.toBeNull();

      ctx.io.socket.emit.mockClear();
      await middleware(ctx, next);

      expect(ctx.io.socket.emit).not.toHaveBeenCalled();
    });

    test("throws hard when now >= expiresAt", async () => {
      const past = new Date(Date.now() - 1_000);
      const ctx = makeCtx({ getExpiresAt: () => past });
      const middleware = useAccessToken(ACCESS_MOUNT);

      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);
      expect(ctx.io.socket.emit).not.toHaveBeenCalled();
    });

    // The fast path returns `expiresAt`/`strategy` to the dispatch site so the
    // socket arm logs through the SAME timer the http arm uses. Assert the
    // round-trip, or a wrong/dropped value would pass every other test here.
    test("logs the accepted fast path with expiresAt and strategy", async () => {
      const expiresAt = new Date("2099-01-01T00:00:00.000Z");
      const ctx = makeCtx({ strategy: "dpop-bearer", getExpiresAt: () => expiresAt });
      const middleware = useAccessToken(ACCESS_MOUNT);

      await middleware(ctx, next);

      const timer = (ctx.logger.timer as Mock).mock.results[0].value;
      expect(timer.debug).toHaveBeenCalledWith("Access token fast-path accepted", {
        expiresAt,
        strategy: "dpop-bearer",
      });
    });

    test("throws Unauthorized when socket.data.pylon.auth is missing", async () => {
      const ctx = makeCtx();
      ctx.io.socket.data.pylon = {};

      const middleware = useAccessToken(ACCESS_MOUNT);
      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);
    });
  });

  // The handshake phase used to be REFUSED here (`createAccessTokenMiddleware`
  // threw `access_token_middleware_in_handshake` and pointed at a second
  // factory). One mount now serves it — the exhaustive handshake coverage lives
  // in use-access-token.handshake.test.ts; this pins the DISPATCH.
  describe("handshake context", () => {
    test("runs the handshake arm instead of refusing it", async () => {
      const ctx: any = {
        aegis: createMockAegis(),
        auth: { introspect: vi.fn() },
        logger: createMockLogger(),
        handshakeId: "abc",
        io: {
          socket: {
            handshake: { auth: { bearer: joseShapedToken() }, headers: {} },
            data: { tokens: {}, pylon: {} },
          },
        },
        state: { access: null, app: { config: APP_CONFIG }, tokens: {} },
      };
      (ctx.aegis.verify as Mock).mockResolvedValue({
        claims: accessClaims({ expiresAt: new Date("2099-01-01T00:00:00.000Z") }),
        custom: {},
        header: { tokenType: "access_token" },
        token: joseShapedToken(),
      });

      await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).resolves.toBeUndefined();

      expect(ctx.io.socket.data.pylon.access.provenance).toBe("verified");
      expect(ctx.io.socket.data.pylon.auth.strategy).toBe("bearer");
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  // No mount states an issuer, so a deployment that resolved none has nothing to
  // verify against. Refuse by name rather than resolve with no `issuer` matcher —
  // that is not a weaker check, it is NO check.
  describe("unresolved issuer", () => {
    const makeCtx = (auth: any): any => ({
      aegis: createMockAegis(),
      auth: { introspect: vi.fn() },
      logger: createMockLogger(),
      request: {},
      state: {
        access: null,
        app: { config: createTestAppConfig({ auth }) },
        authorization: { type: "bearer", value: joseShapedToken() },
        session: null,
        tokens: {},
      },
    });

    test("throws ServerError when the deployment configured no auth block", async () => {
      const ctx = makeCtx(null);

      await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).rejects.toMatchObject({
        code: "access_issuer_unresolved",
        type: "urn:lindorm:pylon:error:access_issuer_unresolved",
        data: { auth: "unconfigured" },
      });
      expect(ctx.aegis.verify).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    test("throws ServerError when the driver could not settle an issuer", async () => {
      const ctx = makeCtx(createTestAuthConfig({ issuer: null }));

      await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).rejects.toThrow(ServerError);
      await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).rejects.toMatchObject({
        data: { auth: "unresolved" },
      });
      expect(ctx.aegis.verify).not.toHaveBeenCalled();
    });

    // ⚠ EXPECTATION FLIPPED. This used to assert an opaque credential still
    // resolved with no issuer settled, on the grounds that RFC 7662 makes the
    // authorization server the authority on it. `resolveAccessIssuer` now runs
    // BEFORE the arms and both require its answer: "the authority answered" is
    // not "the answer came from OUR authority", and an opaque credential that
    // skipped the comparison was the laxer of two arms serving one mount.
    test("refuses an opaque token too when no issuer is resolved", async () => {
      const ctx = makeCtx(createTestAuthConfig({ issuer: null }));
      ctx.state.authorization = { type: "bearer", value: OPAQUE_TOKEN };

      await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).rejects.toMatchObject({
        code: "access_issuer_unresolved",
        data: { auth: "unresolved" },
      });
      expect(ctx.auth.introspect).not.toHaveBeenCalled();
      expect(ctx.state.access).toBeNull();
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("common", () => {
    test("throws 401 when verification fails", async () => {
      const ctx: any = {
        aegis: createMockAegis(),
        auth: { introspect: vi.fn() },
        logger: createMockLogger(),
        request: {},
        state: {
          access: null,
          app: { config: APP_CONFIG },
          authorization: { type: "bearer", value: joseShapedToken() },
          session: null,
          tokens: {},
        },
      };

      (ctx.aegis.verify as Mock).mockRejectedValue(new Error("invalid signature"));

      const middleware = useAccessToken(ACCESS_MOUNT);
      await expect(middleware(ctx, next)).rejects.toMatchObject({
        status: 401,
        code: "access_token_verification_failed",
      });
      expect(ctx.state.access).toBeNull();
    });
  });
});
