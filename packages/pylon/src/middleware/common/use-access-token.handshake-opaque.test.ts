import type { IAegis } from "@lindorm/aegis";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeAll, beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import {
  ACCESS_TEST_ISSUER,
  createTestAegis,
  mintOpaqueCws,
} from "../../__fixtures__/access/aegis.js";
import {
  createDpopTestClient,
  type DpopTestClient,
} from "../../__fixtures__/access/dpop.js";
import {
  ACCESS_MOUNT,
  ACCESS_TEST_AUDIENCE,
  OPAQUE_TOKEN,
  introspectionAnswer,
} from "../../__fixtures__/access/tokens.js";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../__fixtures__/app-config.js";
import type { PylonIntrospectionActive } from "../../types/index.js";
import { useAccessToken } from "./use-access-token.js";

const APP_CONFIG = createTestAppConfig({
  auth: createTestAuthConfig({ issuer: ACCESS_TEST_ISSUER }),
});

const HANDSHAKE_HTU = "https://api.example.com/socket.io/";

const LIVE_EXPIRY = new Date("2099-01-01T00:00:00.000Z");

/**
 * An RFC 7662 answer that clears the floor for THIS suite. It restates `issuer`
 * because the deployment here pins the real-Aegis issuer, not the one
 * `accessClaims` defaults to — and the issuer predicate is a hard `$eq` on both
 * arms now, so an answer that names the wrong one (or none) is refused.
 */
const answer = (
  overrides: Partial<PylonIntrospectionActive> = {},
): PylonIntrospectionActive =>
  introspectionAnswer({
    issuer: ACCESS_TEST_ISSUER,
    expiresAt: LIVE_EXPIRY,
    ...overrides,
  });

/**
 * BUG 3 — an opaque credential could not authenticate over a socket handshake AT
 * ALL.
 *
 * The handshake arm had its own resolution: it called `aegis.parse(token)`
 * unconditionally as a DPoP preflight, and `parse` is a CLAIMS reader. A signed
 * handle (JWS/CWS) throws `parse_requires_claims` there and a bare handle throws
 * `unsupported_token_type` — before any introspection could happen, which the
 * handshake never reached because it had none. The same credential worked over
 * HTTP, so a deployment issuing opaque tokens had a websocket transport its own
 * clients could not connect to.
 *
 * Both transports now run the SAME `resolveAccess`, so there is one answer to
 * "what is this credential" rather than two.
 */
describe("useAccessToken — handshake with an OPAQUE credential", () => {
  let aegis: IAegis;
  let next: Mock;

  const makeCtx = (bearer: string, dpopHeader?: string): any => ({
    aegis,
    auth: { introspect: vi.fn() },
    logger: createMockLogger(),
    handshakeId: "hsk-1",
    state: { access: null, app: { config: APP_CONFIG }, tokens: {} },
    io: {
      socket: {
        handshake: {
          auth: { bearer },
          headers: dpopHeader
            ? { host: "api.example.com", dpop: dpopHeader }
            : { host: "api.example.com" },
          secure: true,
          url: "/socket.io/?EIO=4&transport=websocket",
        },
        data: { app: {}, tokens: {}, pylon: {} },
      },
    },
  });

  beforeAll(() => {
    aegis = createTestAegis(createMockLogger());
  });

  beforeEach(() => {
    next = vi.fn();
  });

  test("introspects a bare opaque handle and registers auth", async () => {
    const ctx = makeCtx(OPAQUE_TOKEN);
    ctx.auth.introspect.mockResolvedValue(answer({ scope: ["openid"] }));

    await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.auth.introspect).toHaveBeenCalledWith(OPAQUE_TOKEN, { cache: undefined });
    expect(ctx.io.socket.data.pylon.auth.strategy).toBe("bearer");
    expect(ctx.io.socket.data.pylon.auth.getExpiresAt()).toEqual(LIVE_EXPIRY);
    expect(ctx.io.socket.data.pylon.access.provenance).toBe("introspected");
    expect(ctx.io.socket.data.pylon.access.claims.subject).toBe("alice");
    // No VerifiedToken exists behind an introspection answer — never synthesise one.
    expect(ctx.io.socket.data.tokens.bearer).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  // The signed-but-opaque handle: a real COSE_Sign1 whose payload IS the handle.
  // `aegis.parse` refuses it by name (`parse_requires_claims`), which is exactly
  // what the old preflight hit.
  test("introspects a signed opaque handle (CWS) it could not even parse before", async () => {
    const cws = await mintOpaqueCws(aegis);
    const ctx = makeCtx(cws);
    ctx.auth.introspect.mockResolvedValue(answer());

    // The preflight the old handshake arm ran, still refusing this credential —
    // so the test states WHY the old path could not serve it.
    expect(() => aegis.parse(cws)).toThrow(
      expect.objectContaining({ code: "parse_requires_claims" }),
    );

    await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).resolves.toBeUndefined();
    expect(ctx.io.socket.data.pylon.access.provenance).toBe("introspected");
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("refuses an inactive handle", async () => {
    const ctx = makeCtx(OPAQUE_TOKEN);
    ctx.auth.introspect.mockResolvedValue({ active: false });

    await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).rejects.toMatchObject({
      status: 401,
      code: "token_not_active",
    });
    expect(ctx.io.socket.data.pylon.auth).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });

  // ⚠ NEW REFUSAL. RFC 7662 §2.2 `token_type` is asserted PRESENT: the structured
  // arm can never produce a credential whose type went unstated, so an answer of
  // bare `{ active: true, … }` must not be the one shape that slips past.
  test("refuses an active handle whose answer declares no token_type", async () => {
    const ctx = makeCtx(OPAQUE_TOKEN);
    ctx.auth.introspect.mockResolvedValue({ ...answer(), tokenType: undefined });

    await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).rejects.toMatchObject({
      status: 401,
      code: "introspection_token_type_missing",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("refuses an opaque handle when the driver cannot introspect", async () => {
    const ctx = makeCtx(OPAQUE_TOKEN);
    ctx.state.app.config = createTestAppConfig({
      auth: createTestAuthConfig({
        issuer: ACCESS_TEST_ISSUER,
        capabilities: { introspect: false, userinfo: false },
      }),
    });

    await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).rejects.toMatchObject({
      status: 401,
      code: "opaque_token_not_supported",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("applies the mount's matchers to the introspected handshake credential", async () => {
    const ctx = makeCtx(OPAQUE_TOKEN);
    ctx.auth.introspect.mockResolvedValue(
      answer({ audience: ["https://other.test.lindorm.io"] }),
    );

    await expect(
      useAccessToken({ audience: ACCESS_TEST_AUDIENCE })(ctx, next),
    ).rejects.toMatchObject({
      status: 401,
      code: "access_token_claims_invalid",
      data: { invalid: ["audience"], provenance: "introspected" },
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("honours the mount's introspection cache carve-out", async () => {
    const ctx = makeCtx(OPAQUE_TOKEN);
    ctx.auth.introspect.mockResolvedValue(answer());

    await useAccessToken({ ...ACCESS_MOUNT, cache: false })(ctx, next);

    expect(ctx.auth.introspect).toHaveBeenCalledWith(OPAQUE_TOKEN, { cache: false });
  });

  /**
   * RFC 9449 §6.2: a DPoP-bound OPAQUE token conveys its `cnf.jkt` through the
   * introspection response, and the resource server validates the binding
   * locally. Over a handshake that could not happen at all before — the
   * credential never resolved — so this is proof-of-possession the socket
   * transport did not have.
   */
  describe("DPoP-bound opaque handle (RFC 9449 §6.2)", () => {
    let client: DpopTestClient;

    beforeAll(async () => {
      client = await createDpopTestClient();
    });

    const introspectsBound = (ctx: any): void => {
      ctx.auth.introspect.mockResolvedValue(
        answer({ confirmation: { thumbprint: client.jkt } }),
      );
    };

    test("accepts a valid proof and records the dpop-bearer strategy", async () => {
      const proof = await client.sign({
        method: "GET",
        uri: HANDSHAKE_HTU,
        accessToken: OPAQUE_TOKEN,
      });
      const ctx = makeCtx(OPAQUE_TOKEN, proof);
      introspectsBound(ctx);

      await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).resolves.toBeUndefined();

      expect(ctx.io.socket.data.pylon.auth.strategy).toBe("dpop-bearer");
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("refuses a bound handle presented with no proof", async () => {
      const ctx = makeCtx(OPAQUE_TOKEN);
      introspectsBound(ctx);

      await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).rejects.toMatchObject({
        code: "missing_dpop_proof",
        data: { provenance: "introspected" },
      });
    });

    test("refuses a proof made for another origin", async () => {
      const proof = await client.sign({
        method: "GET",
        uri: "https://evil.example.com/socket.io/",
        accessToken: OPAQUE_TOKEN,
      });
      const ctx = makeCtx(OPAQUE_TOKEN, proof);
      introspectsBound(ctx);

      await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).rejects.toMatchObject({
        code: "dpop_htu_mismatch",
      });
    });

    test('dpop: "required" is satisfied by a bound opaque handle', async () => {
      const proof = await client.sign({
        method: "GET",
        uri: HANDSHAKE_HTU,
        accessToken: OPAQUE_TOKEN,
      });
      const ctx = makeCtx(OPAQUE_TOKEN, proof);
      introspectsBound(ctx);

      await expect(
        useAccessToken({ ...ACCESS_MOUNT, dpop: "required" })(ctx, next),
      ).resolves.toBeUndefined();
      expect(ctx.io.socket.data.pylon.auth.strategy).toBe("dpop-bearer");
    });

    test('dpop: "required" refuses an UNBOUND opaque handle', async () => {
      const proof = await client.sign({
        method: "GET",
        uri: HANDSHAKE_HTU,
        accessToken: OPAQUE_TOKEN,
      });
      const ctx = makeCtx(OPAQUE_TOKEN, proof);
      ctx.auth.introspect.mockResolvedValue(answer());

      await expect(
        useAccessToken({ ...ACCESS_MOUNT, dpop: "required" })(ctx, next),
      ).rejects.toMatchObject({ code: "handshake_dpop_binding_missing" });
    });
  });
});
