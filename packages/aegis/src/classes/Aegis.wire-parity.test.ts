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

      await expect(aegis.verify(jwt)).rejects.toMatchObject({
        code: "jwt_missing_claim_exp",
      });
      await expect(aegis.verify(cwt)).rejects.toMatchObject({
        code: "cwt_missing_claim_exp",
      });
    });

    // The bare call and the empty-object call are the same call. Behaviour that
    // turns on `{}` is behaviour nobody can predict from the signature.
    test("should reach the same verdict whether options is absent or empty", async () => {
      const cwt = await mintExpLess("cwt");

      await expect(aegis.verify(cwt)).rejects.toMatchObject({
        code: "cwt_missing_claim_exp",
      });
      await expect(aegis.verify(cwt, undefined, {})).rejects.toMatchObject({
        code: "cwt_missing_claim_exp",
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
      ).rejects.toMatchObject({ code: "jwt_claims_invalid" });
      await expect(
        aegis.verify(cwt.token, { tokenId: "not-the-token-id" }),
      ).rejects.toMatchObject({ code: "cwt_claims_invalid" });
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
      ).rejects.toMatchObject({ code: "jwt_claims_invalid" });
      await expect(
        aegis.verify(cwt.token, { tokenId: { $exists: false } }),
      ).rejects.toMatchObject({ code: "cwt_claims_invalid" });
    });
  });

  /**
   * OIDC Core §13.3 — sensitive claims surface only from an ENCRYPTED token.
   *
   * The gate lives in the token read path rather than the shared claim
   * resolution, because that is the only layer that knows whether a token was
   * encrypted. All four combinations belong together: two of them passing is
   * what a gate stuck in either position looks like.
   */
  describe("sensitive claims — the §13.3 encryption gate", () => {
    const content = {
      subject: "user-1",
      audience: ["client-1"],
      sensitive: { nationalIdentityNumber: "ABC-123" },
    };

    test("should SURFACE sensitive claims from an encrypted token on both wires", async () => {
      amphora.add(TEST_EC_KEY_ENC);
      amphora.add(TEST_OCT_KEY_ENC);

      const jwe = await aegis.mint("id_token", content, { encrypt: {} });
      const cwe = await aegis.mint("id_token", content, {
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
   * A profile's `rules` and `validate` are its STRUCTURAL policy, and the
   * profile type says all its policy fields "apply on whichever side the profile
   * is used". They ran at mint only.
   *
   * `external_access_token` is the profile that makes this matter: it is
   * `use: "verify"`, so its policy block had never executed on ANY path — the
   * profile written specifically to police a token from an issuer we do not
   * control was the one whose policy was dead.
   *
   * Every token here is built OUTSIDE aegis's mint (signed with `jose`, or via
   * the raw passthrough namespace for COSE), because a token aegis minted would
   * already have passed the very rules under test.
   */
  describe("profile rules + validate on verify", () => {
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
    test("should enforce profile rules on both wires", async () => {
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
    test("should enforce profile validate on both wires", async () => {
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
