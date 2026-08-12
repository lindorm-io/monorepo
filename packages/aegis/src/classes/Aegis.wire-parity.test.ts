import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { importJWK, SignJWT } from "jose";
import type { ILogger } from "@lindorm/logger";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import {
  TEST_EC_KEY_ENC,
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_ENC,
} from "../__fixtures__/keys.js";
import { Aegis } from "./Aegis.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";

/**
 * The both-wires suite: every case mints the SAME domain content twice — once as
 * JOSE, once as COSE — and asserts the two verifies reach the same verdict.
 *
 * It exists because nothing else can catch this class. pylon discards non-JWT
 * verified tokens at eleven sites, so a COSE regression produces no consumer
 * signal at all, and the per-wire unit tests each pass happily while the two
 * wires disagree. Each case here corresponds to a row of `VERIFY_OPTION_PARITY`
 * or to a profile-policy field that must apply on both.
 */
describe("Aegis — JOSE/COSE wire parity", () => {
  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG);
  });

  // `userinfo` is `lifetime: null`, so it mints with NO exp on either wire — the
  // cheapest way to put a real exp-less token in front of both verifies.
  const mintExpLess = async (format?: "cwt") =>
    (
      await aegis.mint(
        "userinfo",
        { subject: "user-1", audience: ["client-1"] },
        format ? { format } : {},
      )
    ).token;

  describe("expPresence — default 'required'", () => {
    // ⚠ The two codes still differ (`jwt_` vs `cwt_`); unifying the domain
    // surface to wire-neutral names is a later step. What must match TODAY is
    // the VERDICT: both refuse.
    test("should refuse an exp-less token on both wires when called with no arguments", async () => {
      const jwt = await mintExpLess();
      const cwt = await mintExpLess("cwt");

      // ⚠ The CODE is now wire-neutral, so it can no longer tell the two apart —
      // which is exactly why `data.format` exists. Asserting it here is what
      // keeps this file a PARITY test: without it, a routing mix-up that read a
      // CWT through the JOSE wire would reach the same verdict and pass.
      await expect(aegis.verify(jwt)).rejects.toMatchObject({
        code: "missing_claim_exp",
        data: { format: "jwt" },
      });
      await expect(aegis.verify(cwt)).rejects.toMatchObject({
        code: "missing_claim_exp",
        data: { format: "cwt" },
      });
    });

    // The bare call and the empty-object call are the same call. Behaviour that
    // turns on `{}` is behaviour nobody can predict from the signature.
    test("should reach the same verdict whether options is absent or empty", async () => {
      const cwt = await mintExpLess("cwt");

      await expect(aegis.verify(cwt)).rejects.toMatchObject({
        code: "missing_claim_exp",
        data: { format: "cwt" },
      });
      await expect(aegis.verify(cwt, undefined, {})).rejects.toMatchObject({
        code: "missing_claim_exp",
        data: { format: "cwt" },
      });
    });

    test("should accept an exp-less token on both wires when told exp is optional", async () => {
      const jwt = await mintExpLess();
      const cwt = await mintExpLess("cwt");

      await expect(
        aegis.verify(jwt, undefined, { expPresence: "optional" }),
      ).resolves.toMatchObject({ format: "jwt" });
      await expect(
        aegis.verify(cwt, undefined, { expPresence: "optional" }),
      ).resolves.toMatchObject({ format: "cwt" });
    });
  });

  // `tokenId` is the ONE domain claim whose wire name diverges: `jti` on JOSE,
  // `cti` on COSE (RFC 8392). It is the only claim in the registry carrying a
  // `coseName`, so this pair covers the whole divergence.
  describe("assert.tokenId — the jti/cti divergence", () => {
    const mintAccessToken = async (format?: "cwt") =>
      aegis.mint(
        "access_token",
        {
          subject: "user-1",
          audience: ["https://rs.lindorm.io/"],
          clientId: "client-1",
        },
        format ? { format } : {},
      );

    test("should ACCEPT a matching tokenId on both wires", async () => {
      const jwt = await mintAccessToken();
      const cwt = await mintAccessToken("cwt");

      await expect(
        aegis.verify(jwt.token, { tokenId: jwt.tokenId }),
      ).resolves.toMatchObject({ format: "jwt" });
      await expect(
        aegis.verify(cwt.token, { tokenId: cwt.tokenId }),
      ).resolves.toMatchObject({ format: "cwt" });
    });

    test("should REJECT a mismatching tokenId on both wires", async () => {
      const jwt = await mintAccessToken();
      const cwt = await mintAccessToken("cwt");

      await expect(
        aegis.verify(jwt.token, { tokenId: "not-the-token-id" }),
      ).rejects.toMatchObject({ code: "claims_invalid" });
      await expect(
        aegis.verify(cwt.token, { tokenId: "not-the-token-id" }),
      ).rejects.toMatchObject({ code: "claims_invalid" });
    });

    // The fail-OPEN direction, and the one that matters: a replay guard asking
    // "does this token carry an id at all?" must not get a silent yes from a
    // token that has one. On COSE the predicate was keyed `jti` and applied to a
    // `cti`-keyed wire, so `$exists: false` was trivially true.
    test("should REJECT an $exists:false tokenId on both wires when the token HAS one", async () => {
      const jwt = await mintAccessToken();
      const cwt = await mintAccessToken("cwt");

      expect(jwt.tokenId).toBeDefined();
      expect(cwt.tokenId).toBeDefined();

      await expect(
        aegis.verify(jwt.token, { tokenId: { $exists: false } }),
      ).rejects.toMatchObject({ code: "claims_invalid" });
      await expect(
        aegis.verify(cwt.token, { tokenId: { $exists: false } }),
      ).rejects.toMatchObject({ code: "claims_invalid" });
    });
  });

  /**
   * The confidentiality gate — a sensitive claim surfaces only from an ENCRYPTED token.
   *
   * The gate lives in the token read path rather than the shared claim
   * resolution, because that is the only layer that knows whether a token was
   * encrypted. All four combinations belong together: two of them passing is
   * what a gate stuck in either position looks like.
   */
  describe("sensitive claims — the confidentiality gate", () => {
    const content = {
      subject: "user-1",
      audience: ["client-1"],
      sensitive: { nationalIdentityNumber: "ABC-123" },
    };

    test("should SURFACE sensitive claims from an encrypted token on both wires", async () => {
      amphora.add(TEST_EC_KEY_ENC);
      amphora.add(TEST_OCT_KEY_ENC);

      const jwe = await aegis.mint("id_token", content, {
        context: { accessTokenIssued: false },
        encrypt: {},
      });
      const cwe = await aegis.mint("id_token", content, {
        context: { accessTokenIssued: false },
        format: "cwt",
        encrypt: {},
      });

      const verifiedJose = await aegis.verify("id_token", jwe.token, undefined, {
        audience: "client-1",
      });
      const verifiedCose = await aegis.verify("id_token", cwe.token, undefined, {
        audience: "client-1",
      });

      expect(verifiedJose.sensitive).toEqual({ nationalIdentityNumber: "ABC-123" });
      expect(verifiedCose.sensitive).toEqual({ nationalIdentityNumber: "ABC-123" });
    });

    // ⚠ Built OUTSIDE mint, deliberately. Mint STRIPS sensitive fields it cannot
    // encrypt rather than emitting them in clear, so a plain `mint` token never
    // carries them and a test using one passes whether the gate works or not —
    // this test WAS written that way and proved nothing. The raw namespaces are
    // passthroughs, so they can put the flat claims on an unencrypted wire that
    // no mint path would ever produce, which is the only input that exercises
    // the read-side gate at all.
    test("should SUPPRESS sensitive claims on an unencrypted token on both wires", async () => {
      const now = Math.floor(new Date("2024-01-01T08:00:00.000Z").getTime() / 1000);
      const flat = {
        iss: ISSUER,
        sub: "user-1",
        aud: ["client-1"],
        exp: now + 3600,
        national_identity_number: "ABC-123",
      };

      const key = await importJWK(
        TEST_EC_KEY_SIG.export("jwk") as never,
        TEST_EC_KEY_SIG.algorithm,
      );
      const jwt = await new SignJWT(flat)
        .setProtectedHeader({
          alg: TEST_EC_KEY_SIG.algorithm,
          kid: TEST_EC_KEY_SIG.id,
          typ: "JWT",
        })
        .sign(key);
      const cwt = (await aegis.cwt.sign(flat)).token;

      const verifiedJose = await aegis.verify(jwt);
      const verifiedCose = await aegis.verify(cwt);

      expect(verifiedJose.sensitive).toBeUndefined();
      expect(verifiedCose.sensitive).toBeUndefined();

      // Suppressed means GONE, not relocated: absent from `claims` AND `custom`,
      // or a sensitive claim merely demoted out of the bucket still reads as a
      // pass.
      expect(verifiedJose.claims).not.toHaveProperty("nationalIdentityNumber");
      expect(verifiedCose.claims).not.toHaveProperty("nationalIdentityNumber");
      expect(verifiedJose.custom).toEqual({});
      expect(verifiedCose.custom).toEqual({});
    });
  });

  /**
   * The verify KNOBS that reached only the JOSE path. Each was accepted and
   * dropped on a CWT — the caller asked for a check and silently got none — and
   * each corresponds to a `bug` row that this closes in the wire-parity table.
   */
  describe("verify options that the COSE path used to drop", () => {
    const now = Math.floor(new Date("2024-01-01T08:00:00.000Z").getTime() / 1000);

    // A DPoP-bound token, built through the raw namespaces so the binding is on
    // an ordinary access token without mint's cnf plumbing. `jkt` must be a real
    // 32-byte base64url thumbprint or the COSE encoder refuses to emit it.
    const JKT = Buffer.alloc(32, 7).toString("base64url");
    const bound = {
      iss: ISSUER,
      sub: "user-1",
      aud: ["https://rs.lindorm.io/"],
      exp: now + 3600,
      iat: now,
      cnf: { jkt: JKT },
    };

    const signJose = async (claims: Record<string, unknown>): Promise<string> => {
      const key = await importJWK(
        TEST_EC_KEY_SIG.export("jwk") as never,
        TEST_EC_KEY_SIG.algorithm,
      );

      return new SignJWT(claims)
        .setProtectedHeader({
          alg: TEST_EC_KEY_SIG.algorithm,
          kid: TEST_EC_KEY_SIG.id,
          typ: "JWT",
        })
        .sign(key);
    };

    const signCose = async (claims: Record<string, unknown>): Promise<string> =>
      (await aegis.cwt.sign(claims)).token;

    // ⚠ The DPoP binding is enforced by the SHARED policy now, so the rule is
    // identical on both wires — but it is currently UNREACHABLE on COSE, and not
    // because of anything aegis chose. RFC 8747's COSE `cnf` map has members for
    // an embedded COSE_Key and a `kid` and nothing else: there is no COSE
    // equivalent of `jkt` (jkt is not ckt). So the encoder refuses to emit a
    // thumbprint confirmation at all, and no CWT can carry the binding the DPoP
    // check would police.
    //
    // Pinned rather than skipped: if a COSE `jkt` representation is ever added,
    // this test fails and the DPoP pair below it becomes constructible.
    test("should refuse to put a jkt confirmation on a COSE wire at all", async () => {
      await expect(signCose(bound)).rejects.toMatchObject({
        code: "cose_cnf_unsupported",
      });
    });

    test("should refuse a DPoP-bound JWT with no proof", async () => {
      await expect(aegis.verify(await signJose(bound))).rejects.toMatchObject({
        code: "dpop_proof_required",
      });
    });

    test("should honour trustBoundThumbprint", async () => {
      await expect(
        aegis.verify(await signJose(bound), undefined, { trustBoundThumbprint: true }),
      ).resolves.toMatchObject({ format: "jwt" });
    });

    // `actor` — the act-chain policy. It needs `delegation` populated, which the
    // COSE result never carried at all.
    test("should enforce the actor policy on both wires", async () => {
      const delegated = {
        iss: ISSUER,
        sub: "user-1",
        aud: ["https://rs.lindorm.io/"],
        exp: now + 3600,
        iat: now,
        act: { sub: "service-a" },
      };
      const options = { actor: { forbidden: true } };

      await expect(
        aegis.verify(await signJose(delegated), undefined, options),
      ).rejects.toMatchObject({ code: "actor_not_allowed" });
      await expect(
        aegis.verify(await signCose(delegated), undefined, options),
      ).rejects.toMatchObject({ code: "actor_not_allowed" });
    });

    test("should report the act chain in the result on both wires", async () => {
      const delegated = {
        iss: ISSUER,
        sub: "user-1",
        aud: ["https://rs.lindorm.io/"],
        exp: now + 3600,
        iat: now,
        act: { sub: "service-a" },
      };

      const jose = await aegis.verify(await signJose(delegated));
      const cose = await aegis.verify(await signCose(delegated));

      expect(jose.delegation?.isDelegated).toBe(true);
      expect(cose.delegation?.isDelegated).toBe(true);
    });

    // `key` — the per-call verification key POLICY. A condition no key in the
    // vault satisfies must fail the lookup, not be ignored.
    test("should apply the per-call key policy on both wires", async () => {
      const plain = {
        iss: ISSUER,
        sub: "user-1",
        aud: ["https://rs.lindorm.io/"],
        exp: now + 3600,
        iat: now,
      };
      const options = { key: { condition: { id: "no-such-key-id" } } };

      await expect(
        aegis.verify(await signJose(plain), undefined, options),
      ).rejects.toThrow();
      await expect(
        aegis.verify(await signCose(plain), undefined, options),
      ).rejects.toThrow();
    });
  });

  /**
   * The MINT side of the same problem: the two encoders assemble the domain claim
   * layer separately, so a content bucket one of them merges and the other does
   * not is lost silently — the token mints, and the claims are simply gone.
   */
  describe("mint content buckets", () => {
    const content = {
      subject: "user-1",
      audience: ["client-1"],
      profile: { givenName: "Ada", email: "ada@example.com" },
    };

    // Live DATA LOSS: the COSE encoder merged `sensitive` and not `profile`,
    // while COSE verify reads a `profile` bucket back — so the claims were
    // written nowhere and read from a bucket nothing had filled.
    test("should carry content.profile onto both wires", async () => {
      const jwt = await aegis.mint("id_token", content, {
        context: { accessTokenIssued: false },
      });
      const cwt = await aegis.mint("id_token", content, {
        context: { accessTokenIssued: false },
        format: "cwt",
      });

      const jose = await aegis.verify("id_token", jwt.token, undefined, {
        audience: "client-1",
      });
      const cose = await aegis.verify("id_token", cwt.token, undefined, {
        audience: "client-1",
      });

      expect(jose.profile).toMatchObject({ givenName: "Ada", email: "ada@example.com" });
      expect(cose.profile).toMatchObject({ givenName: "Ada", email: "ada@example.com" });
    });

    // `sign.header` — the caller's protected header bag. `oid` has a COSE label
    // (private-use -70000), so this was never a wire limitation: the COSE
    // encoder simply never forwarded the bag, and `objectId` came back
    // undefined on every CWT.
    test("should carry sign.header onto both wires", async () => {
      const options = {
        context: { accessTokenIssued: false },
        sign: { header: { objectId: "obj_abc" } },
      } as never;

      const jwt = await aegis.mint("id_token", content, options);
      const cwt = await aegis.mint("id_token", content, {
        ...(options as object),
        format: "cwt",
      } as never);

      // ⚠ NOT asserting `SignedToken.objectId` here: neither encoder populates
      // that field from `sign.header` today (the JOSE one does not either), so
      // it is a separate gap from the header bag being forwarded at all.
      const jose = await aegis.verify("id_token", jwt.token, undefined, {
        audience: "client-1",
      });
      const cose = await aegis.verify("id_token", cwt.token, undefined, {
        audience: "client-1",
      });

      expect(jose.protectedHeader.objectId).toBe("obj_abc");

      // COSE now answers the same way. `coseDomainHeader` used to be built from
      // a hand-picked {alg, kid, typ} triple, so a parameter the issuer had
      // SIGNED could reach the wire and then exist nowhere a caller could see
      // it; it is built from the whole protected bucket now.
      expect(cose.protectedHeader.objectId).toBe("obj_abc");
      expect((await aegis.cwt.verify(cwt.token)).protectedHeader.oid).toBe("obj_abc");
    });

    // `omit` is a MODE, not a claim list: "empty" (the default) prunes empty
    // containers from the wire, "undefined" preserves them. It can be given on
    // the mint options or as a per-sign fallback, and only the JOSE encoder
    // honoured the fallback.
    test("should honour the sign.omit fallback on both wires", async () => {
      const withEmpty = { ...content, authMethods: [] as Array<string> };
      const options = {
        context: { accessTokenIssued: false },
        sign: { omit: "undefined" },
      } as never;

      const jwt = await aegis.mint("id_token", withEmpty, options);
      const cwt = await aegis.mint("id_token", withEmpty, {
        ...(options as object),
        format: "cwt",
      } as never);

      // The empty array survives the prune on BOTH wires because the per-sign
      // mode reached both encoders.
      expect((await aegis.jwt.verify(jwt.token)).payload).toHaveProperty("amr");
      expect((await aegis.cwt.verify(cwt.token)).payload).toHaveProperty("amr");
    });
  });

  /**
   * A profile's `match` and `shape` rules are its STRUCTURAL policy. Each names
   * the direction(s) it runs in and the one enforcer applies whichever name the
   * direction being enforced, so the verify half cannot be quietly omitted.
   *
   * `external_access_token` is the profile that makes this matter: it is
   * `use: "verify"`, so a mint-only structural policy would never execute on ANY
   * path — the profile written specifically to police a token from an issuer we
   * do not control would be the one whose policy was dead.
   *
   * Every token here is built OUTSIDE aegis's mint (signed with `jose`, or via
   * the raw passthrough namespace for COSE), because a token aegis minted would
   * already have passed the very rules under test.
   */
  describe("profile match + shape rules on verify", () => {
    const RESOURCE = "https://rs.lindorm.io/";
    const NOT_A_URI = "acme-corp-not-a-uri";
    const now = Math.floor(new Date("2024-01-01T08:00:00.000Z").getTime() / 1000);

    // Both raw namespaces are PASSTHROUGHS — they sign the payload verbatim in
    // its own wire spelling. That is why the token id is written `jti` for JOSE
    // and `cti` for COSE (RFC 8392): the identical domain claim, spelled per
    // wire, which is precisely the divergence these tests exist to police.
    const signJose = async (claims: Record<string, unknown>): Promise<string> => {
      const key = await importJWK(
        TEST_EC_KEY_SIG.export("jwk") as never,
        TEST_EC_KEY_SIG.algorithm,
      );

      return new SignJWT({ ...claims, jti: "token-1" })
        .setProtectedHeader({ alg: TEST_EC_KEY_SIG.algorithm, kid: TEST_EC_KEY_SIG.id })
        .sign(key);
    };

    const signCose = async (claims: Record<string, unknown>): Promise<string> =>
      (await aegis.cwt.sign({ ...claims, cti: "token-1" })).token;

    // `rules` — ISSUER_IS_URI. A third-party token whose `iss` is a bare
    // identifier rather than a URI must not verify under a profile that demands
    // one.
    test("should enforce a profile match rule on both wires", async () => {
      const claims = {
        iss: NOT_A_URI,
        sub: "user-1",
        aud: [RESOURCE],
        exp: now + 3600,
        iat: now,
      };

      await expect(
        aegis.verify("external_access_token", await signJose(claims), undefined, {
          audience: RESOURCE,
        }),
      ).rejects.toMatchObject({ code: "profile_policy_invalid" });

      await expect(
        aegis.verify("external_access_token", await signCose(claims), undefined, {
          audience: RESOURCE,
        }),
      ).rejects.toMatchObject({ code: "profile_policy_invalid" });
    });

    // `validate` — crossField. An envelope that expires BEFORE it was issued is
    // incoherent whatever else is true of it (RFC 7519 §4.1.4/§4.1.6).
    //
    // `verifyIssuedAt: false` lifts the kit's iat upper bound so the structural
    // rule is what rejects the token rather than the temporal range check —
    // that option is honoured identically on both wires, so the two sides stay
    // comparable.
    //
    // ⚠ cnfShape and actChainShape would be the more obvious `validate` rules to
    // test, and neither can be reached from here: the read-side extractor
    // DISCARDS a malformed `cnf`/`act` before any rule sees it, and the COSE
    // encoder refuses to emit one at all. See the note in the findings file —
    // wiring `validate` in makes the rule live, but most of its inputs are
    // sanitised upstream.
    test("should enforce a profile shape rule on both wires", async () => {
      const claims = {
        iss: ISSUER,
        sub: "user-1",
        aud: [RESOURCE],
        exp: now + 3600,
        iat: now + 7200,
      };

      await expect(
        aegis.verify("external_access_token", await signJose(claims), undefined, {
          audience: RESOURCE,
          verifyIssuedAt: false,
        }),
      ).rejects.toMatchObject({ code: "profile_policy_invalid" });

      await expect(
        aegis.verify("external_access_token", await signCose(claims), undefined, {
          audience: RESOURCE,
          verifyIssuedAt: false,
        }),
      ).rejects.toMatchObject({ code: "profile_policy_invalid" });
    });

    // The control: the same shape, conformant, must still verify on both wires.
    // Without this the pair above would pass just as well if the profile
    // rejected everything.
    test("should accept a policy-conformant token on both wires", async () => {
      const claims = {
        iss: ISSUER,
        sub: "user-1",
        aud: [RESOURCE],
        exp: now + 3600,
        iat: now,
      };

      await expect(
        aegis.verify("external_access_token", await signJose(claims), undefined, {
          audience: RESOURCE,
        }),
      ).resolves.toMatchObject({ format: "jwt" });

      await expect(
        aegis.verify("external_access_token", await signCose(claims), undefined, {
          audience: RESOURCE,
        }),
      ).resolves.toMatchObject({ format: "cwt" });
    });
  });
});
