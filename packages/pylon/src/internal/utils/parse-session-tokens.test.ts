import { AegisError } from "@lindorm/aegis";
import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test, type Mock } from "vitest";
import { createTestAegis, mintTestAccessToken } from "../../__fixtures__/access/aegis.js";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../__fixtures__/app-config.js";
import type { IPylonSession } from "../../interfaces/index.js";
import { parseSessionTokens } from "./parse-session-tokens.js";

const verified = (token: string, format: "jwt" | "jws" = "jwt"): any => ({
  claims: { subject: "alice" },
  custom: {},
  format,
  header: {},
  token,
});

describe("parseSessionTokens", () => {
  let ctx: any;
  let session: IPylonSession;

  beforeEach(() => {
    ctx = {
      aegis: createMockAegis(),
      state: {
        app: { config: createTestAppConfig({ auth: createTestAuthConfig() }) },
        tokens: {},
      },
    };

    session = {
      id: "4f38fec0-70cb-53cb-b82b-42b41e7f986e",
      accessToken: "access-token",
      expiresAt: new Date(Date.now() + 3600000),
      idToken: "id-token",
      issuedAt: new Date(),
      refreshToken: "refresh-token",
      scope: ["openid"],
      subject: "643881f8-f6b0-5a18-9396-6fbe29ebfec8",
    };

    (ctx.aegis.verify as Mock).mockImplementation(async (token: string) =>
      verified(token),
    );
  });

  test("a token whose crit names a declared parameter verifies through the session token path", async () => {
    const aegis = createTestAegis(createMockLogger());
    const accessToken = await mintTestAccessToken(
      aegis,
      {},
      { sign: { header: { critical: ["objectId"], objectId: "1.2.3.4" } } },
    );

    const declared: any = {
      aegis,
      state: {
        app: {
          config: createTestAppConfig({
            auth: createTestAuthConfig({ critical: ["objectId"] }),
          }),
        },
        tokens: {},
      },
    };

    await parseSessionTokens(declared, { ...session, accessToken, idToken: undefined });

    expect(declared.state.tokens.accessToken?.header.objectId).toBe("1.2.3.4");

    // The swallow path: undeclared means no parse, so the bucket is DELETED
    // rather than left stale.
    const undeclared: any = {
      aegis,
      state: {
        app: { config: createTestAppConfig({ auth: createTestAuthConfig() }) },
        tokens: { accessToken: declared.state.tokens.accessToken },
      },
    };

    await parseSessionTokens(undeclared, {
      ...session,
      accessToken,
      idToken: undefined,
    });

    expect(undeclared.state.tokens).toEqual({});
  });

  test("forwards the deployment critical declaration to aegis", async () => {
    ctx.state.app = {
      config: createTestAppConfig({
        auth: createTestAuthConfig({ critical: ["objectId"] }),
      }),
    };

    await parseSessionTokens(ctx, session);

    expect(ctx.aegis.verify).toHaveBeenCalledWith("access-token", undefined, {
      critical: ["objectId"],
    });
    expect(ctx.aegis.verify).toHaveBeenCalledWith("id-token", undefined, {
      critical: ["objectId"],
    });
  });

  test("should publish the session's structured tokens", async () => {
    await parseSessionTokens(ctx, session);

    expect(ctx.state.tokens.accessToken).toMatchSnapshot();
    expect(ctx.state.tokens.idToken).toMatchSnapshot();
  });

  /**
   * ⚠ The stale-bucket case. A session that WAS structured and is replaced by
   * one that is not — a provider rotating onto an opaque credential — must not
   * leave the previous parse standing beside the new session. Nothing
   * downstream can tell a stale parse from a current one, and
   * `ctx.auth.introspect()` answers from these buckets in preference to the
   * session itself.
   */
  test("should clear a bucket whose token no longer verifies", async () => {
    await parseSessionTokens(ctx, session);

    expect(ctx.state.tokens.accessToken).toBeDefined();
    expect(ctx.state.tokens.idToken).toBeDefined();

    (ctx.aegis.verify as Mock).mockRejectedValue(
      new AegisError("opaque credential", { code: "invalid_token" }),
    );

    await parseSessionTokens(ctx, { ...session, accessToken: "opaque-token" });

    expect(ctx.state.tokens).toEqual({});
  });

  test("should clear a bucket whose token is not a jwt", async () => {
    await parseSessionTokens(ctx, session);

    (ctx.aegis.verify as Mock).mockImplementation(async (token: string) =>
      verified(token, "jws"),
    );

    await parseSessionTokens(ctx, session);

    expect(ctx.state.tokens).toEqual({});
  });

  test("should clear both buckets when there is no session", async () => {
    await parseSessionTokens(ctx, session);

    await parseSessionTokens(ctx, null);

    expect(ctx.state.tokens).toEqual({});
  });

  test("should leave the id token bucket empty when the session carries none", async () => {
    await parseSessionTokens(ctx, { ...session, idToken: undefined });

    expect(ctx.state.tokens.accessToken).toBeDefined();
    expect(ctx.state.tokens.idToken).toBeUndefined();
  });

  // An aegis failure is a statement about the TOKEN. Anything else is a fault in
  // this process and must not be read as "the credential is opaque".
  test("should rethrow an error that is not an aegis error", async () => {
    (ctx.aegis.verify as Mock).mockRejectedValue(new Error("vault unreachable"));

    await expect(parseSessionTokens(ctx, session)).rejects.toThrow("vault unreachable");
  });
});
