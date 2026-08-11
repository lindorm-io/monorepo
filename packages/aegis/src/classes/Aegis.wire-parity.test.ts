import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
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
});
