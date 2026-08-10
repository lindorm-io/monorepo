import type { IAegis } from "@lindorm/aegis";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeAll, beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import {
  ACCESS_TEST_ISSUER,
  createTestAegis,
  mintTestAccessToken,
} from "../../__fixtures__/access/aegis.js";
import {
  createDpopTestClient,
  type DpopTestClient,
} from "../../__fixtures__/access/dpop.js";
import { ACCESS_TEST_AUDIENCE } from "../../__fixtures__/access/tokens.js";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../__fixtures__/app-config.js";
import { useAccessToken } from "./use-access-token.js";

const APP_CONFIG = createTestAppConfig({
  auth: createTestAuthConfig({ issuer: ACCESS_TEST_ISSUER }),
});

const MOUNT = { audience: ACCESS_TEST_AUDIENCE };

/**
 * The COOKIE-SESSION arm answers to the same checks as the header arms.
 *
 * It used to sit outside both of them: the credential was parsed and published
 * with no claim assert and no proof-of-possession check at all, so a mount's
 * `audience` — the one thing only the mount knows — was a silent no-op for every
 * browser-presented credential, and a DPoP-BOUND token was served as a plain
 * bearer purely because it arrived in a cookie.
 */
describe("useAccessToken — the cookie-session arm", () => {
  let aegis: IAegis;
  let dpop: DpopTestClient;
  let ctx: any;
  let next: Mock;

  beforeAll(async () => {
    aegis = createTestAegis(createMockLogger());
    dpop = await createDpopTestClient();
  });

  const session = (accessToken: string): object => ({
    id: "sess-1",
    accessToken,
    expiresAt: new Date("2999-01-01T00:00:00.000Z"),
    issuedAt: new Date(),
    scope: ["openid"],
    subject: "alice",
  });

  beforeEach(() => {
    next = vi.fn();
    ctx = {
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
        app: { config: APP_CONFIG },
        authorization: { type: "none", value: null },
        session: null,
        tokens: {},
      },
    };
  });

  test("a session credential for this resource server is served", async () => {
    ctx.state.session = session(await mintTestAccessToken(aegis));

    await expect(useAccessToken(MOUNT)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.state.access.provenance).toBe("verified");
    expect(ctx.state.access.claims.subject).toBe("alice");
    expect(ctx.state.tokens.accessToken).toBeDefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("a session credential audienced elsewhere is refused", async () => {
    ctx.state.session = session(
      await mintTestAccessToken(aegis, { audience: ["https://other.example.com"] }),
    );

    await expect(useAccessToken(MOUNT)(ctx, next)).rejects.toMatchObject({
      status: 401,
      code: "access_token_claims_invalid",
    });

    expect(ctx.state.access).toBeNull();
    expect(ctx.state.tokens.accessToken).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });

  test("a session credential the mount's matchers reject is refused", async () => {
    ctx.state.session = session(
      await mintTestAccessToken(aegis, { permissions: ["users:read"] }),
    );

    await expect(
      useAccessToken({ ...MOUNT, permissions: ["users:delete"] })(ctx, next),
    ).rejects.toMatchObject({ status: 401, code: "access_token_claims_invalid" });

    expect(ctx.state.access).toBeNull();
    expect(next).not.toHaveBeenCalled();
  });

  /**
   * RFC 9449 §7.1: a bound token requires a matching proof, and a browser
   * presents none — so a bound credential in a cookie must NOT be served as a
   * plain bearer.
   *
   * It is refused UPSTREAM of pylon's own binding check, by aegis: the session
   * arm verifies with the RFC 9449-strict default (no `trustBoundThumbprint`),
   * so a `cnf.jkt` token with no proof never verifies at all. That is why the
   * session arm carries no `assertDpopBinding` call — one placed there would be
   * unreachable — and this test is what says so, so the next reader does not
   * "fix" the missing check back in.
   *
   * ⚠ The reason reaching the client is `invalid_session_access_token`, which
   * names the outcome and not the cause. Distinguishing "unreadable" from
   * "bound, and you sent no proof" would mean `extractTokenFromSession`
   * reporting WHY aegis refused.
   */
  test("a DPoP-BOUND session credential is refused, not downgraded to a bearer", async () => {
    ctx.state.session = session(
      await mintTestAccessToken(aegis, { confirmation: { thumbprint: dpop.jkt } }),
    );

    await expect(useAccessToken(MOUNT)(ctx, next)).rejects.toMatchObject({
      status: 401,
      code: "invalid_session_access_token",
    });

    expect(ctx.state.access).toBeNull();
    expect(next).not.toHaveBeenCalled();
  });
});
