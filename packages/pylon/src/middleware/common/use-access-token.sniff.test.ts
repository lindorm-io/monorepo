import type { IAegis } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import {
  ACCESS_TEST_ISSUER,
  createTestAegis,
  mintOpaqueCws,
  mintTestAccessToken,
  tamperPayload,
} from "../../__fixtures__/access/aegis.js";
import {
  ACCESS_MOUNT,
  ACCESS_TEST_AUDIENCE,
  OPAQUE_TOKEN,
  introspectionAnswer,
} from "../../__fixtures__/access/tokens.js";
import { useAccessToken } from "./use-access-token.js";
import { beforeAll, beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../__fixtures__/app-config.js";
import type { PylonIntrospectionActive } from "../../types/index.js";

/** Auth configured with a driver that CAN introspect — the ordinary resource
 *  server, so the opaque arm is reachable. */
const APP_CONFIG = createTestAppConfig({
  auth: createTestAuthConfig({ issuer: ACCESS_TEST_ISSUER }),
});

/** An RFC 7662 answer that clears the floor this deployment pins. */
const answer = (
  overrides: Partial<PylonIntrospectionActive> = {},
): PylonIntrospectionActive =>
  introspectionAnswer({ issuer: ACCESS_TEST_ISSUER, ...overrides });

/**
 * The format sniff, proved against a REAL Aegis and a REAL signature. The point
 * under test is the routing rule: a JOSE-shaped credential is verified locally
 * and MUST NOT be able to reach introspection by failing, because the
 * authorization server has no opinion on a token it never issued.
 */
describe("useAccessToken — format sniff", () => {
  let aegis: IAegis;
  let ctx: any;
  let next: Mock;
  let token: string;

  beforeAll(async () => {
    aegis = createTestAegis(createMockLogger());

    // Under the `access_token` PROFILE (RFC 9068) — the only thing this
    // middleware verifies, so anything else fails for a reason that is not the
    // sniff.
    token = await mintTestAccessToken(aegis, { permissions: ["users:read"] });
  });

  beforeEach(() => {
    next = vi.fn();
    ctx = {
      aegis,
      auth: { introspect: vi.fn() },
      logger: createMockLogger(),
      request: {},
      state: {
        access: null,
        app: { config: APP_CONFIG },
        authorization: { type: "bearer", value: token },
        session: null,
        tokens: {},
      },
    };
  });

  test("verifies a genuine JWT locally and never introspects it", async () => {
    await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.auth.introspect).not.toHaveBeenCalled();
    expect(ctx.state.access.provenance).toBe("verified");
    expect(ctx.state.access.claims.subject).toBe("alice");
    expect(ctx.state.access.token).toBe(token);
    expect(ctx.state.tokens.accessToken).toBeDefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("a TAMPERED JWT fails and is NEVER introspected", async () => {
    ctx.state.authorization = {
      type: "bearer",
      value: tamperPayload(token, {
        sub: "mallory",
        iss: ACCESS_TEST_ISSUER,
        aud: [ACCESS_TEST_AUDIENCE],
        client_id: "client-a",
        jti: "tampered",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        permissions: ["users:read", "users:delete"],
      }),
    };

    await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).rejects.toThrow(ClientError);

    // The security-critical assertion: no fall-through to the authorization
    // server, so a forged token can never be laundered into an active answer.
    expect(ctx.auth.introspect).not.toHaveBeenCalled();
    expect(ctx.state.access).toBeNull();
    expect(ctx.state.tokens.accessToken).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });

  test("a JWT with a garbled signature fails and is NEVER introspected", async () => {
    const [header, payload] = token.split(".");
    ctx.state.authorization = {
      type: "bearer",
      value: [header, payload, "AAAA"].join("."),
    };

    await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).rejects.toThrow(ClientError);

    expect(ctx.auth.introspect).not.toHaveBeenCalled();
    expect(ctx.state.access).toBeNull();
  });

  test("an opaque credential is introspected, never handed to aegis", async () => {
    const verify = vi.spyOn(aegis, "verify");
    ctx.state.authorization = { type: "bearer", value: OPAQUE_TOKEN };
    ctx.auth.introspect.mockResolvedValue(answer());

    await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).resolves.toBeUndefined();

    expect(verify).not.toHaveBeenCalled();
    expect(ctx.auth.introspect).toHaveBeenCalledWith(OPAQUE_TOKEN, {
      cache: undefined,
    });
    expect(ctx.state.access.provenance).toBe("introspected");

    verify.mockRestore();
  });

  // A driver with no `introspect` is the NORMAL configuration for a service that
  // mints and verifies its own JWTs. The credential is unresolvable here — say
  // so, rather than reporting a verification that mysteriously failed.
  test("an opaque credential is refused by name when the driver cannot introspect", async () => {
    // The capability is DERIVED from the driver and lives in state, so a
    // deployment whose driver cannot introspect says so here.
    ctx.state.app.config = createTestAppConfig({
      auth: createTestAuthConfig({
        issuer: ACCESS_TEST_ISSUER,
        capabilities: { introspect: false, userinfo: false },
      }),
    });
    ctx.state.authorization = { type: "bearer", value: OPAQUE_TOKEN };

    await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).rejects.toMatchObject({
      code: "opaque_token_not_supported",
      type: "urn:lindorm:pylon:error:opaque_token_not_supported",
      status: 401,
    });

    expect(ctx.auth.introspect).not.toHaveBeenCalled();
    expect(ctx.state.access).toBeNull();
    expect(next).not.toHaveBeenCalled();
  });
});

/**
 * The sniff decides VERIFY-LOCALLY vs INTROSPECT, and the only property that can
 * decide it is whether the credential has a CLAIMS LAYER aegis can establish —
 * not which wire family it belongs to. A signed-but-opaque token (a JWS, or its
 * COSE twin a CWS) is a HANDLE: aegis can check its signature and still learn
 * nothing about it, so the authorization server remains the only authority
 * (RFC 7662). Routing one to local verify would accept it with empty claims —
 * no expiry, no revocation, no record lookup.
 */
describe("useAccessToken — claims-bearing sniff", () => {
  let aegis: IAegis;
  let ctx: any;
  let next: Mock;
  let jwt: string;
  let cwt: string;
  let jwe: string;
  let cws: string;
  let jws: string;

  beforeAll(async () => {
    aegis = createTestAegis(createMockLogger());

    const content = { permissions: ["users:read"] };

    jwt = await mintTestAccessToken(aegis, content);
    cwt = await mintTestAccessToken(aegis, content, { format: "cwt" });

    // Sign-then-encrypt: the outer JWE declares `cty: JWT` (RFC 7519 §5.2), so
    // its plaintext IS a claims-bearing token — verify decrypts and re-verifies
    // the inner JWT, which is the whole point of the format. Wrapped by hand
    // because the access-token profile is `encryptable: false` at MINT; what is
    // under test is the SNIFF, which must route the wrapper to local verify.
    jwe = (await aegis.jwe.encrypt(jwt, { header: { cty: "JWT" } })).token;

    // The two opaque handles: same signature guarantee, no claims layer.
    cws = await mintOpaqueCws(aegis);
    jws = (await aegis.jws.sign(Buffer.from("opaque-handle"))).token;
  });

  beforeEach(() => {
    next = vi.fn();
    ctx = {
      aegis,
      auth: { introspect: vi.fn() },
      logger: createMockLogger(),
      request: {},
      state: {
        access: null,
        app: { config: APP_CONFIG },
        authorization: null,
        session: null,
        tokens: {},
      },
    };
  });

  const present = (token: string): void => {
    ctx.state.authorization = { type: "bearer", value: token };
  };

  test("an opaque COSE handle (CWS) is introspected, never verified locally", async () => {
    const verify = vi.spyOn(aegis, "verify");
    present(cws);
    ctx.auth.introspect.mockResolvedValue(answer());

    await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).resolves.toBeUndefined();

    expect(verify).not.toHaveBeenCalled();
    expect(ctx.auth.introspect).toHaveBeenCalledWith(cws, { cache: undefined });
    expect(ctx.state.access.provenance).toBe("introspected");
    expect(ctx.state.access.claims.subject).toBe("alice");

    verify.mockRestore();
  });

  test("an opaque JOSE handle (JWS) is introspected, never verified locally", async () => {
    const verify = vi.spyOn(aegis, "verify");
    present(jws);
    ctx.auth.introspect.mockResolvedValue(answer());

    await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).resolves.toBeUndefined();

    expect(verify).not.toHaveBeenCalled();
    expect(ctx.auth.introspect).toHaveBeenCalledWith(jws, { cache: undefined });
    expect(ctx.state.access.provenance).toBe("introspected");

    verify.mockRestore();
  });

  test("an opaque handle is refused, not verified, when the driver cannot introspect", async () => {
    ctx.state.app.config = createTestAppConfig({
      auth: createTestAuthConfig({
        issuer: ACCESS_TEST_ISSUER,
        capabilities: { introspect: false, userinfo: false },
      }),
    });
    present(cws);

    await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).rejects.toMatchObject({
      code: "opaque_token_not_supported",
      status: 401,
    });

    expect(ctx.state.access).toBeNull();
    expect(next).not.toHaveBeenCalled();
  });

  test("a JWT verifies locally and is never introspected", async () => {
    present(jwt);

    await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.auth.introspect).not.toHaveBeenCalled();
    expect(ctx.state.access.provenance).toBe("verified");
    expect(ctx.state.access.claims.subject).toBe("alice");
  });

  test("a CWT verifies locally and is never introspected", async () => {
    present(cwt);

    await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.auth.introspect).not.toHaveBeenCalled();
    expect(ctx.state.access.provenance).toBe("verified");
    expect(ctx.state.access.claims.subject).toBe("alice");
  });

  test("a sign-then-encrypt JWE verifies locally and is never introspected", async () => {
    present(jwe);

    await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.auth.introspect).not.toHaveBeenCalled();
    expect(ctx.state.access.provenance).toBe("verified");
    expect(ctx.state.access.claims.subject).toBe("alice");
  });
});
