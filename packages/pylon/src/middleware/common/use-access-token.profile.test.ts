import type { IAegis } from "@lindorm/aegis";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeAll, beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import {
  ACCESS_TEST_ISSUER,
  createTestAegis,
  mintTestAccessToken,
} from "../../__fixtures__/access/aegis.js";
import {
  ACCESS_TEST_AUDIENCE,
  OPAQUE_TOKEN,
  introspectionAnswer,
} from "../../__fixtures__/access/tokens.js";
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
 * What `useAccessToken` ASSERTS about a credential, proved against a REAL Aegis
 * and real signatures on both arms.
 *
 * Every test here states an observable outcome — the request is served, or it is
 * refused with a named code — and never the shape of a call. A suite that
 * asserted "verify was called with `tokenType: access_token`" stayed green
 * through the whole window in which that option was accepted by aegis and
 * silently DROPPED, because pylon went on producing the argument it had always
 * produced. The assertion has to be that a token of the wrong type does not get
 * in.
 */
describe("useAccessToken — what a credential must be", () => {
  let aegis: IAegis;
  let ctx: any;
  let next: Mock;

  beforeAll(() => {
    aegis = createTestAegis(createMockLogger());
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

  describe("structured — verified against the access_token profile", () => {
    test("an access token for this resource server is served", async () => {
      present(await mintTestAccessToken(aegis));

      await expect(useAccessToken(MOUNT)(ctx, next)).resolves.toBeUndefined();

      expect(ctx.state.access.provenance).toBe("verified");
      expect(ctx.state.access.claims.subject).toBe("alice");
      expect(next).toHaveBeenCalledTimes(1);
    });

    // The type-confusion case, and the reason `tokenType` is not a mount option.
    // The id_token is minted by the SAME issuer, live, and audienced at THIS
    // resource server — so it clears every check an audience-and-issuer gate can
    // make. What it cannot clear is its own declared type: the profile floor
    // compares `typ` first (`JWT` vs `application/at+jwt`, RFC 9068 §2.2). A
    // resource server that accepts an id_token as a bearer credential accepts a
    // token the client was given to READ, not to spend.
    test("an ID TOKEN is refused, however well it otherwise fits", async () => {
      const { token } = await aegis.mint("id_token", {
        audience: [ACCESS_TEST_AUDIENCE],
        subject: "alice",
      });
      present(token);

      await expect(useAccessToken(MOUNT)(ctx, next)).rejects.toMatchObject({
        status: 401,
        code: "access_token_verification_failed",
      });

      expect(ctx.state.access).toBeNull();
      expect(ctx.auth.introspect).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    test("an access token audienced at another resource server is refused", async () => {
      present(
        await mintTestAccessToken(aegis, { audience: ["https://other.example.com"] }),
      );

      await expect(useAccessToken(MOUNT)(ctx, next)).rejects.toMatchObject({
        status: 401,
      });

      expect(ctx.state.access).toBeNull();
      expect(next).not.toHaveBeenCalled();
    });

    test("an access token from another issuer is refused", async () => {
      ctx.state.app.config = createTestAppConfig({
        auth: createTestAuthConfig({ issuer: "https://elsewhere.example.com" }),
      });
      present(await mintTestAccessToken(aegis));

      await expect(useAccessToken(MOUNT)(ctx, next)).rejects.toMatchObject({
        status: 401,
      });

      expect(ctx.state.access).toBeNull();
    });

    // The COSE wire reaches the same profiled verify, and pylon hands it no
    // `assert` argument at all — which is what keeps it clear of the aegis defect
    // where profiled verify on a COSE token ignores `assert`. If pylon ever moves
    // a matcher into that argument, this is the credential it would vanish on.
    test("a CWT access token is served, with the same claims as its JWT twin", async () => {
      present(await mintTestAccessToken(aegis, {}, { format: "cwt" }));

      await expect(useAccessToken(MOUNT)(ctx, next)).resolves.toBeUndefined();

      expect(ctx.state.access.provenance).toBe("verified");
      expect(ctx.state.access.claims.subject).toBe("alice");
      expect(ctx.state.access.claims.issuer).toBe(ACCESS_TEST_ISSUER);
    });
  });

  describe("introspected — the opaque arm answers to the same floor", () => {
    beforeEach(() => {
      present(OPAQUE_TOKEN);
    });

    test("an answer naming this issuer and this audience is served", async () => {
      ctx.auth.introspect.mockResolvedValue(
        introspectionAnswer({
          issuer: ACCESS_TEST_ISSUER,
          audience: [ACCESS_TEST_AUDIENCE],
        }),
      );

      await expect(useAccessToken(MOUNT)(ctx, next)).resolves.toBeUndefined();

      expect(ctx.state.access.provenance).toBe("introspected");
      expect(next).toHaveBeenCalledTimes(1);
    });

    // RFC 7662 §2.2 makes `iss` OPTIONAL, and tolerating its absence made the
    // opaque arm the laxer of two arms serving one mount: the structured arm
    // rejects a foreign issuer unconditionally. An authorization server that will
    // not name itself is one this deployment cannot pin.
    test("an answer that names no issuer is refused", async () => {
      const answer = introspectionAnswer({ audience: [ACCESS_TEST_AUDIENCE] });
      delete answer.issuer;
      ctx.auth.introspect.mockResolvedValue(answer);

      await expect(useAccessToken(MOUNT)(ctx, next)).rejects.toMatchObject({
        status: 401,
        code: "access_token_claims_invalid",
      });

      expect(ctx.state.access).toBeNull();
      expect(next).not.toHaveBeenCalled();
    });

    test("an answer naming a foreign issuer is refused", async () => {
      ctx.auth.introspect.mockResolvedValue(
        introspectionAnswer({
          issuer: "https://elsewhere.example.com",
          audience: [ACCESS_TEST_AUDIENCE],
        }),
      );

      await expect(useAccessToken(MOUNT)(ctx, next)).rejects.toMatchObject({
        status: 401,
        code: "access_token_claims_invalid",
      });
    });

    // The structured arm can never produce a credential whose type went
    // unstated — the profile floor matches the `typ` header. A bare
    // `{ active: true }` must not be the one shape that slips past.
    test("an answer that states no token type is refused", async () => {
      const answer = introspectionAnswer({
        issuer: ACCESS_TEST_ISSUER,
        audience: [ACCESS_TEST_AUDIENCE],
      });
      delete answer.tokenType;
      ctx.auth.introspect.mockResolvedValue(answer);

      await expect(useAccessToken(MOUNT)(ctx, next)).rejects.toMatchObject({
        status: 401,
        code: "introspection_token_type_missing",
      });

      expect(ctx.state.access).toBeNull();
    });

    test("an answer for another audience is refused", async () => {
      ctx.auth.introspect.mockResolvedValue(
        introspectionAnswer({
          issuer: ACCESS_TEST_ISSUER,
          audience: ["https://other.example.com"],
        }),
      );

      await expect(useAccessToken(MOUNT)(ctx, next)).rejects.toMatchObject({
        status: 401,
        code: "access_token_claims_invalid",
      });
    });
  });

  // A dependency failure is not a verdict on the caller's credential. The
  // middleware's catch logs and RETHROWS: a store that is down surfaces as
  // itself, with the status it earned, rather than as "your token is bad".
  test("a driver failure is not laundered into a 401", async () => {
    class StoreError extends Error {}
    present(OPAQUE_TOKEN);
    ctx.auth.introspect.mockRejectedValue(new StoreError("redis is down"));

    await expect(useAccessToken(MOUNT)(ctx, next)).rejects.toThrow(StoreError);

    expect(ctx.state.access).toBeNull();
    expect(next).not.toHaveBeenCalled();
  });
});
