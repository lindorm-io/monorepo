import type { IAegis } from "@lindorm/aegis";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeAll, beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import {
  ACCESS_TEST_ISSUER,
  createTestAegis,
  mintExternalAccessToken,
  mintTestAccessToken,
  mintTestIdToken,
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

    /**
     * The type-confusion case, and the reason `tokenType` is not a mount option.
     * The id_token is minted by the SAME issuer, live, and audienced at THIS
     * resource server — so it clears every check an audience-and-issuer gate can
     * make. What it cannot clear is its own declared type: the profile floor
     * compares `typ` first (`JWT` vs `application/at+jwt`, RFC 9068 §2.2). A
     * resource server that accepts an id_token as a bearer credential accepts a
     * token the client was given to READ, not to spend.
     *
     * ⚠ `data` NAMES the floor that refused it, and that is what makes this test
     * able to fail. A bare `code: access_token_verification_failed` is pylon's
     * wrapper over EVERY aegis refusal, so it cannot tell TYPE from anything
     * else — and the fixture it was written against (an id_token with no `jti`)
     * would have gone on passing under a default that had quietly widened to the
     * lenient profile, refused on `jwt_required_claims_missing` instead. This is
     * `mintTestIdToken`, which carries `jti` AND the `nonce` the lenient
     * profile's `forbidden` list bites on, so every plausible loss of the type
     * discrimination changes `data` and turns this red.
     *
     * ⚠ The ONE strict-floor claim this fixture cannot carry is `client_id`:
     * `IdTokenContent` does not admit it, and no real id_token has one — its
     * `aud` IS the client. So the assertion has to name the typ rather than rely
     * on typ being the only check the token could fail.
     */
    test("an ID TOKEN is refused, however well it otherwise fits", async () => {
      present(await mintTestIdToken(aegis));

      await expect(useAccessToken(MOUNT)(ctx, next)).rejects.toMatchObject({
        status: 401,
        code: "access_token_verification_failed",
        data: { typ: "JWT" },
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

    // ⚠ THE RELAXATION MUST NOT REACH THIS ARM. The shared claim assert now
    // tolerates an ABSENT `iss` (RFC 7662 §2.2 makes it a MAY on the OTHER arm),
    // and a structured credential answers to `iss` regardless — twice over,
    // before that pass runs: the deployment's issuer SCOPES the verification key
    // lookup, and the `access_token` profile floor exact-matches the claim and
    // lists `issuer` in its required set. A token from an issuer this deployment
    // did not pin never reaches a valid signature, let alone the matchers.
    test("an access token from another issuer is refused", async () => {
      ctx.state.app.config = createTestAppConfig({
        auth: createTestAuthConfig({ issuer: "https://elsewhere.example.com" }),
      });
      present(await mintTestAccessToken(aegis));

      await expect(useAccessToken(MOUNT)(ctx, next)).rejects.toMatchObject({
        status: 401,
        code: "access_token_verification_failed",
      });

      expect(ctx.state.access).toBeNull();
      expect(next).not.toHaveBeenCalled();
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

  /**
   * `profile` picks WHICH floor the structured arm applies. The strict
   * `access_token` (RFC 9068) is the default and stays strict — its `required`
   * list is enforced at MINT as well as verify, so loosening it to admit another
   * issuer's token would also let this deployment ISSUE a degraded one. A
   * resource server accepting a third party's tokens names the second profile.
   */
  describe("profile — which floor the structured arm applies", () => {
    const EXTERNAL = { ...MOUNT, profile: "external_access_token" as const };

    // The default, stated by OMITTING the option: the same third-party wire the
    // lenient mount serves below is refused here. Anything less would mean the
    // default had quietly widened.
    //
    // `data` names WHICH floor refused it — the strict profile's `typ` floor,
    // over the bare `JWT` this token carries. It is the aegis error's own data,
    // merged into the 401 the caller receives, so it is part of the answer and
    // not an internal read.
    test("a third-party-shaped token is refused when no profile is named", async () => {
      present(await mintExternalAccessToken(aegis));

      await expect(useAccessToken(MOUNT)(ctx, next)).rejects.toMatchObject({
        status: 401,
        code: "access_token_verification_failed",
        data: { typ: "JWT" },
      });

      expect(ctx.state.access).toBeNull();
      expect(next).not.toHaveBeenCalled();
    });

    // All three relaxations at once — bare `typ: JWT` (RFC 7515 §4.1.9 makes typ
    // optional and `application/at+jwt` is far from universal), two audiences
    // rather than the one our own ADR pins, and no `client_id` (REQUIRED by RFC
    // 9068 §2.2 and routinely absent elsewhere).
    test("the lenient profile serves a bare typ, several audiences and no client_id", async () => {
      present(await mintExternalAccessToken(aegis));

      await expect(useAccessToken(EXTERNAL)(ctx, next)).resolves.toBeUndefined();

      expect(ctx.state.access.provenance).toBe("verified");
      expect(ctx.state.access.claims.subject).toBe("alice");
      expect(ctx.state.access.claims.clientId).toBeUndefined();
      expect(next).toHaveBeenCalledTimes(1);
    });

    /**
     * ⚠ THE ID-TOKEN DEFENCE, at the composition that matters. With no typ
     * mandated there is no structural discriminator left — `typ: JWT` is exactly
     * what an id_token carries — so `nonce`/`at_hash`/`c_hash`/`s_hash` are what
     * keeps one out. The token below is a REAL id_token from this same issuer,
     * live, carrying `jti`/`iat`/`exp`/`sub`, and audienced at the RESOURCE
     * SERVER rather than at the client, so it defeats the mount's audience check
     * on purpose. Nothing but the profile's `forbidden` list stands in its way.
     */
    test("a well-formed id_token is refused on a lenient mount", async () => {
      present(await mintTestIdToken(aegis));

      await expect(useAccessToken(EXTERNAL)(ctx, next)).rejects.toMatchObject({
        status: 401,
        code: "access_token_verification_failed",
        // The claim that bit, NAMED — not "refused for some reason". aegis
        // reports one `invalid` array for every policy rule (a token can fail
        // `forbidden` AND `required` at once), so the forbidden claim appears
        // as an entry, not as a bucket of its own.
        data: { invalid: [{ key: "nonce" }] },
      });

      expect(ctx.state.access).toBeNull();
      expect(ctx.auth.introspect).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    // The control that makes the refusal above MEAN something: the SAME mint,
    // minus the one id_token claim, clears every other floor check. So the
    // refusal is the forbidden list biting, not an incidental failure over a
    // missing `jti` or a typ this profile never mandated.
    test("...and it is the id_token claim doing it, not an incidental miss", async () => {
      present(await mintTestIdToken(aegis, { nonce: undefined }));

      await expect(useAccessToken(EXTERNAL)(ctx, next)).resolves.toBeUndefined();

      expect(ctx.state.access.provenance).toBe("verified");
    });

    // The SECOND id_token defence, and the half that lives in pylon: an
    // id_token's `aud` is the CLIENT, not the resource server. `audience` is
    // required on every mount, and the lenient profile does not relax it — `aud`
    // must still contain the verifier's own identity.
    test("a token audienced elsewhere is refused on the lenient profile too", async () => {
      present(
        await mintExternalAccessToken(aegis, {
          aud: ["https://other.example.com", "account"],
        }),
      );

      await expect(useAccessToken(EXTERNAL)(ctx, next)).rejects.toMatchObject({
        status: 401,
        code: "access_token_verification_failed",
        data: { audience: ["https://other.example.com", "account"] },
      });

      expect(ctx.state.access).toBeNull();
      expect(next).not.toHaveBeenCalled();
    });

    // The shared claim pass runs on this arm unchanged: relaxing the ENVELOPE
    // floor relaxes nothing a mount stated for itself.
    test("the mount's other matchers still apply on the lenient profile", async () => {
      present(await mintExternalAccessToken(aegis));

      await expect(
        useAccessToken({ ...EXTERNAL, scope: "orders:write" })(ctx, next),
      ).rejects.toMatchObject({
        status: 401,
        code: "access_token_claims_invalid",
      });

      expect(next).not.toHaveBeenCalled();
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

    // RFC 7662 §2.2 makes `iss` a MAY, so an answer that omits it is conformant
    // and is served. It costs nothing: pylon called a SPECIFIC issuer's
    // introspection endpoint — resolved before both arms — so which authority
    // answered is what pins the credential. The claim is corroboration on a pin
    // that already holds.
    test("an answer that names no issuer is served", async () => {
      const answer = introspectionAnswer({ audience: [ACCESS_TEST_AUDIENCE] });
      delete answer.issuer;
      ctx.auth.introspect.mockResolvedValue(answer);

      await expect(useAccessToken(MOUNT)(ctx, next)).resolves.toBeUndefined();

      expect(ctx.state.access.provenance).toBe("introspected");
      expect(ctx.state.access.claims.issuer).toBeUndefined();
      expect(next).toHaveBeenCalledTimes(1);
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

    // RFC 7662 §2.2 makes `token_type` a MAY too, and it is RFC 6749 §7.1's
    // PRESENTATION SCHEME rather than the JOSE `typ` the profile floor matches —
    // a homonym, so there was never an `at+jwt`-shaped value for it to be
    // compared against. A bare answer is conformant and is served.
    test("an answer that states no token type is served", async () => {
      const answer = introspectionAnswer({
        issuer: ACCESS_TEST_ISSUER,
        audience: [ACCESS_TEST_AUDIENCE],
      });
      delete answer.tokenType;
      ctx.auth.introspect.mockResolvedValue(answer);

      await expect(useAccessToken(MOUNT)(ctx, next)).resolves.toBeUndefined();

      expect(ctx.state.access.provenance).toBe("introspected");
      expect(next).toHaveBeenCalledTimes(1);
    });

    // What `token_type` IS compared against: the scheme the request presented.
    // An answer of `DPoP` for a credential presented as `Bearer` is a
    // proof-of-possession bypass — the answer carries no `cnf.jkt`, so the
    // binding check has nothing to compare and the bound credential would be
    // spent as a plain bearer token.
    test("an answer naming a scheme the request did not use is refused", async () => {
      ctx.auth.introspect.mockResolvedValue(
        introspectionAnswer({
          issuer: ACCESS_TEST_ISSUER,
          audience: [ACCESS_TEST_AUDIENCE],
          tokenType: "DPoP",
        }),
      );

      await expect(useAccessToken(MOUNT)(ctx, next)).rejects.toMatchObject({
        status: 401,
        code: "introspection_token_type_mismatch",
      });

      expect(ctx.state.access).toBeNull();
      expect(next).not.toHaveBeenCalled();
    });

    test.each(["bearer", "Bearer", "BEARER"])(
      "an answer of %j matches a Bearer-presented credential",
      async (tokenType) => {
        ctx.auth.introspect.mockResolvedValue(
          introspectionAnswer({
            issuer: ACCESS_TEST_ISSUER,
            audience: [ACCESS_TEST_AUDIENCE],
            tokenType,
          }),
        );

        await expect(useAccessToken(MOUNT)(ctx, next)).resolves.toBeUndefined();
        expect(ctx.state.access.provenance).toBe("introspected");
      },
    );

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
