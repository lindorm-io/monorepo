import type { IAegis } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import {
  ACCESS_TEST_ISSUER,
  createTestAegis,
  tamperPayload,
} from "../../__fixtures__/access/aegis.js";
import { OPAQUE_TOKEN } from "../../__fixtures__/access/tokens.js";
import { createAccessTokenMiddleware } from "./create-access-token-middleware.js";
import { beforeAll, beforeEach, describe, expect, test, vi, type Mock } from "vitest";

/**
 * The format sniff, proved against a REAL Aegis and a REAL signature. The point
 * under test is the routing rule: a JOSE-shaped credential is verified locally
 * and MUST NOT be able to reach introspection by failing, because the
 * authorization server has no opinion on a token it never issued.
 */
describe("createAccessTokenMiddleware — format sniff", () => {
  const options: any = { issuer: ACCESS_TEST_ISSUER };

  let aegis: IAegis;
  let ctx: any;
  let next: Mock;
  let token: string;

  beforeAll(async () => {
    aegis = createTestAegis(createMockLogger());

    const signed = await aegis.mint("default", {
      audience: [ACCESS_TEST_ISSUER],
      expires: "1 hour",
      permissions: ["users:read"],
      subject: "alice",
      tokenType: "access_token",
    });

    token = signed.token;
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
        authorization: { type: "bearer", value: token },
        session: null,
        tokens: {},
      },
    };
  });

  test("verifies a genuine JWT locally and never introspects it", async () => {
    await expect(
      createAccessTokenMiddleware(options)(ctx, next),
    ).resolves.toBeUndefined();

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
        aud: [ACCESS_TEST_ISSUER],
        exp: Math.floor(Date.now() / 1000) + 3600,
        permissions: ["users:read", "users:delete"],
      }),
    };

    await expect(createAccessTokenMiddleware(options)(ctx, next)).rejects.toThrow(
      ClientError,
    );

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

    await expect(createAccessTokenMiddleware(options)(ctx, next)).rejects.toThrow(
      ClientError,
    );

    expect(ctx.auth.introspect).not.toHaveBeenCalled();
    expect(ctx.state.access).toBeNull();
  });

  test("an opaque credential is introspected, never handed to aegis", async () => {
    const verify = vi.spyOn(aegis, "verify");
    ctx.state.authorization = { type: "bearer", value: OPAQUE_TOKEN };
    ctx.auth.introspect.mockResolvedValue({ active: true, subject: "alice" });

    await expect(
      createAccessTokenMiddleware(options)(ctx, next),
    ).resolves.toBeUndefined();

    expect(verify).not.toHaveBeenCalled();
    expect(ctx.auth.introspect).toHaveBeenCalledWith(OPAQUE_TOKEN);
    expect(ctx.state.access.provenance).toBe("introspected");

    verify.mockRestore();
  });
});
