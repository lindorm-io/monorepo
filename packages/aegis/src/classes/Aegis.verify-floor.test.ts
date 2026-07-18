import { Amphora, type IAmphora } from "@lindorm/amphora";
import { B64 } from "@lindorm/b64";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import { JwtError } from "../errors/index.js";
import { B64U } from "../internal/constants/format.js";
import { createJoseSignature } from "../internal/utils/jose-signature.js";
import { Aegis } from "./Aegis.js";
import { beforeEach, describe, expect, test } from "vitest";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";
const RESOURCE = "https://rs.lindorm.io/";

// Hand-built JWS so the header/payload carry EXACTLY the given fields — mint
// always stamps a typ and auto-injects iat, so a typ-less or iat-less token
// can only be produced at the wire level.
const craftToken = (header: Dict, payload: Dict): string => {
  const encodedHeader = B64.encode(JSON.stringify(header), B64U);
  const encodedPayload = B64.encode(JSON.stringify(payload), B64U);
  const signature = createJoseSignature({
    header: encodedHeader,
    payload: encodedPayload,
    kryptos: TEST_EC_KEY_SIG,
  });
  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

const wireHeader = {
  alg: TEST_EC_KEY_SIG.algorithm,
  kid: TEST_EC_KEY_SIG.id,
};

// A per-token-issuer payload (iss = sub = the client), the shape `delegation`
// carries on the wire.
const perTokenPayload = {
  iss: "client-1",
  sub: "client-1",
  aud: [ISSUER],
  iat: 1704096000,
  exp: 1704096120,
  jti: "token-1",
};

describe("Aegis profiled verify floor (§4.4)", () => {
  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ domain: ISSUER, logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG);
  });

  const mintAccessToken = () =>
    aegis.mint("access_token", {
      subject: "user-1",
      audience: [RESOURCE],
      clientId: "client-1",
    });

  test("accepts a token whose aud contains the verifier identity", async () => {
    const { token } = await mintAccessToken();

    await expect(
      aegis.verify("access_token", token, { audience: RESOURCE }),
    ).resolves.toMatchObject({
      payload: { subject: "user-1" },
    });
  });

  test("rejects when aud does not contain the verifier identity", async () => {
    const { token } = await mintAccessToken();

    await expect(
      aegis.verify("access_token", token, { audience: "https://wrong-rs" }),
    ).rejects.toThrow(JwtError);
  });

  test("rejects a wrong issuer", async () => {
    const { token } = await mintAccessToken();

    await expect(
      aegis.verify("access_token", token, {
        audience: RESOURCE,
        issuer: "https://not-the-issuer/",
      }),
    ).rejects.toThrow(JwtError);
  });

  test("rejects a typ mismatch (id_token verified as access_token)", async () => {
    const { token } = await aegis.mint("id_token", {
      subject: "user-1",
      audience: [RESOURCE],
    });

    await expect(
      aegis.verify("access_token", token, { audience: RESOURCE }),
    ).rejects.toThrow(JwtError);
  });

  test("rejects an absent typ for a required-presence profile", async () => {
    const token = craftToken(wireHeader, {
      ...perTokenPayload,
      iss: ISSUER,
      sub: "user-1",
      aud: [RESOURCE],
      client_id: "client-1",
    });

    await expect(
      aegis.verify("access_token", token, { audience: RESOURCE }),
    ).rejects.toThrow(expect.objectContaining({ code: "jwt_typ_mismatch" }));
  });

  test("rejects an access token with no iat — presence policy lives in the floor", async () => {
    // The parse gate does not require iat, so the profile floor is what keeps
    // RFC 9068's REQUIRED iat honest.
    const token = craftToken(
      { ...wireHeader, typ: "application/at+jwt" },
      {
        iss: ISSUER,
        sub: "user-1",
        aud: [RESOURCE],
        exp: 1704096120,
        jti: "access-1",
        client_id: "client-1",
      },
    );

    await expect(
      aegis.verify("access_token", token, { audience: RESOURCE }),
    ).rejects.toThrow(
      expect.objectContaining({
        code: "jwt_required_claims_missing",
        data: { missing: ["issuedAt"] },
      }),
    );
  });

  test("raw jwt.verify rejects a validly-signed typ-less JWT (strict default)", async () => {
    // Regression pin for direct callers (e.g. pylon token middleware): only
    // profiled verify opts into typPresence "optional" — the raw path keeps
    // parse-time explicit typing (RFC 8725) as its typ gate.
    const token = craftToken(wireHeader, {
      ...perTokenPayload,
      iss: ISSUER,
      sub: "user-1",
      aud: [RESOURCE],
    });

    await expect(aegis.jwt.verify(token)).rejects.toThrow(
      expect.objectContaining({ code: "jwt_invalid_typ" }),
    );
  });

  describe("mint → profiled verify round trips", () => {
    test("access_token", async () => {
      const { token } = await mintAccessToken();

      await expect(
        aegis.verify("access_token", token, { audience: RESOURCE }),
      ).resolves.toMatchObject({
        payload: { subject: "user-1", clientId: "client-1" },
      });
    });

    test("id_token", async () => {
      const { token } = await aegis.mint("id_token", {
        subject: "user-1",
        audience: ["client-1"],
      });

      await expect(
        aegis.verify("id_token", token, { audience: "client-1" }),
      ).resolves.toMatchObject({
        payload: { subject: "user-1", issuer: ISSUER },
      });
    });

    test("security_event (COSE) — subjectId and events reach the floor", async () => {
      const { token } = await aegis.mint(
        "security_event",
        {
          audience: ["https://receiver"],
          subjectId: { format: "iss_sub", iss: ISSUER, sub: "user-1" },
          events: { "urn:lindorm:event:test": {} },
        },
        { format: "cwt" },
      );

      await expect(
        aegis.verify("security_event", token, {
          audience: "https://receiver",
        }),
      ).resolves.toMatchObject({
        claims: {
          subjectId: { format: "iss_sub", iss: ISSUER, sub: "user-1" },
          events: { "urn:lindorm:event:test": {} },
        },
      });
    });

    test("security_event (JOSE) — exp-less SET round-trips, subjectId and events reach the floor", async () => {
      // exp presence is now POLICY, not structure: the security_event profile
      // has `lifetime: null`, so profiled verify passes expPresence "optional"
      // and the exp-less JOSE SET verifies — mirroring the COSE path above.
      const { token } = await aegis.mint("security_event", {
        audience: ["https://receiver"],
        subjectId: { format: "iss_sub", iss: ISSUER, sub: "user-1" },
        events: { "urn:lindorm:event:test": {} },
      });

      // JOSE parse is domain-keyed: `subjectId` (wire `sub_id`, RFC 9493) is
      // domain-extracted onto `payload`, while `events` stays a custom claim
      // under `payload.claims` (only subjectId is domain-extracted from SetClaims).
      await expect(
        aegis.verify("security_event", token, { audience: "https://receiver" }),
      ).resolves.toMatchObject({
        payload: {
          subjectId: { format: "iss_sub", iss: ISSUER, sub: "user-1" },
          claims: { events: { "urn:lindorm:event:test": {} } },
        },
      });
    });
  });

  describe("exp presence policy (parse-time structure vs verify-time policy)", () => {
    // A profile-less (raw) verify: exp presence defaults to "required", so an
    // exp-less token is rejected at the matcher — NOT at the parse gate, which
    // no longer requires exp. Passing `expPresence: "optional"` accepts it.
    // Hand-built via craftToken (signed with the amphora-registered key), the
    // wire-level way to put an exp-less JWS on the wire.
    const explessToken = () =>
      craftToken(
        { ...wireHeader, typ: "application/at+jwt" },
        { iss: ISSUER, sub: "user-1", aud: [RESOURCE], iat: 1704096000, jti: "no-exp-1" },
      );

    test("profile-less verify REJECTS an exp-less token by default (clear error)", async () => {
      await expect(aegis.jwt.verify(explessToken())).rejects.toThrow(
        expect.objectContaining({ code: "jwt_missing_claim_exp" }),
      );
    });

    test("profile-less verify ACCEPTS an exp-less token with expPresence 'optional'", async () => {
      await expect(
        aegis.jwt.verify(explessToken(), { expPresence: "optional" }),
      ).resolves.toMatchObject({
        payload: { subject: "user-1", issuer: ISSUER },
      });
    });

    test("a finite-lifetime profile still REJECTS an exp-less token (floor)", async () => {
      // access_token has a finite lifetime, so verifyProfile keeps expPresence
      // "required" — the exp-less craftToken token is rejected. (enforceVerifyFloor
      // is the belt-and-suspenders backstop for the same rule.)
      const token = craftToken(
        { ...wireHeader, typ: "application/at+jwt" },
        {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          iat: 1704096000,
          jti: "access-no-exp",
          client_id: "client-1",
        },
      );

      await expect(
        aegis.verify("access_token", token, { audience: RESOURCE }),
      ).rejects.toThrow(expect.objectContaining({ code: "jwt_missing_claim_exp" }));
    });
  });

  describe("delegation (per-token issuer)", () => {
    const delegationHeader = { ...wireHeader, typ: "application/delegation+jwt" };

    test("mints and verifies its own delegation token", async () => {
      const { token } = await aegis.mint("delegation", {
        issuer: "client-1",
        subject: "customer-sub",
        audience: [ISSUER],
      });

      // jti auto-injected at mint; the floor's required-claims check passes.
      await expect(
        aegis.verify("delegation", token, { audience: ISSUER, issuer: "client-1" }),
      ).resolves.toMatchObject({
        payload: { issuer: "client-1", subject: "customer-sub" },
      });
    });

    test("accepts a token WITHOUT an iat claim (the profile does not require it)", async () => {
      // The mirror of the access_token case above: the parse gate does not
      // require iat, and the floor requires it only where the profile asks.
      // `delegation` omits `issuedAt` from `required` (iat is RECOMMENDED, not
      // REQUIRED), so an iat-less delegation resolves.
      const { iat: _iat, ...withoutIat } = perTokenPayload;
      const token = craftToken(delegationHeader, withoutIat);

      const parsed = await aegis.verify("delegation", token, {
        audience: ISSUER,
        issuer: "client-1",
      });

      expect(parsed.payload.issuedAt).toBeUndefined();
      expect(parsed).toMatchObject({
        payload: { issuer: "client-1", subject: "client-1", tokenId: "token-1" },
      });
    });

    test("rejects a token missing the required jti", async () => {
      const { jti: _jti, ...withoutJti } = perTokenPayload;
      const token = craftToken(delegationHeader, withoutJti);

      await expect(
        aegis.verify("delegation", token, { audience: ISSUER, issuer: "client-1" }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "jwt_required_claims_missing",
          data: { missing: ["tokenId"] },
        }),
      );
    });

    test("rejects a token with an empty-string jti", async () => {
      const token = craftToken(delegationHeader, { ...perTokenPayload, jti: "" });

      await expect(
        aegis.verify("delegation", token, { audience: ISSUER, issuer: "client-1" }),
      ).rejects.toThrow(expect.objectContaining({ code: "jwt_required_claims_missing" }));
    });
  });
});
