import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { CompactSign, importJWK, SignJWT } from "jose";
import MockDate from "mockdate";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import { Aegis } from "./Aegis.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";
const SUBJECT = "user-1";

/**
 * Tokens minted by a THIRD PARTY, i.e. by anything that is not aegis. The wire
 * they produce is the ordinary one — an id_token carries no `typ` at all (RFC
 * 7519 §5.1 makes it optional, and OIDC does not add a requirement), an access
 * token carries RFC 9068's `at+jwt`, and a signed opaque handle carries whatever
 * its issuer felt like. None of them carry aegis's own `JWT`/`JWS` spellings, so
 * routing on those spellings rejected every one of them as an unrecognised wire.
 *
 * Signed with `jose` over the same key the vault holds, so the signature is real
 * and the only thing under test is which branch the token reaches.
 */
describe("Aegis — externally issued tokens", () => {
  let amphora: IAmphora;
  let aegis: Aegis;
  let key: Awaited<ReturnType<typeof importJWK>>;

  let idToken: string;
  let accessToken: string;
  let opaqueJws: string;

  beforeAll(async () => {
    const jwk = TEST_EC_KEY_SIG.export("jwk") as Record<string, unknown>;
    key = await importJWK(jwk as never, "ES512");

    idToken = await new SignJWT({ sub: SUBJECT, aud: "client_1" })
      .setProtectedHeader({ alg: "ES512", kid: TEST_EC_KEY_SIG.id })
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(key);

    accessToken = await new SignJWT({ sub: SUBJECT, scope: "openid" })
      .setProtectedHeader({ alg: "ES512", kid: TEST_EC_KEY_SIG.id, typ: "at+jwt" })
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(key);

    opaqueJws = await new CompactSign(new TextEncoder().encode("opaque-handle"))
      .setProtectedHeader({ alg: "ES512", kid: TEST_EC_KEY_SIG.id })
      .sign(key);
  });

  beforeEach(async () => {
    const logger = createMockLogger();
    amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG);
  });

  describe("an id_token with no typ", () => {
    test("is recognised as a JWT", () => {
      expect(Aegis.isJwt(idToken)).toBe(true);
      expect(Aegis.isJose(idToken)).toBe(true);
    });

    test("parses to the claims branch rather than throwing unsupported_token_type", () => {
      const parsed = aegis.parse(idToken);

      expect(parsed.format).toBe("jwt");
      expect(parsed.claims.subject).toBe(SUBJECT);
      expect(parsed.claims.issuer).toBe(ISSUER);
    });

    test("verifies as a JWT when explicit typing is not demanded", async () => {
      const verified = await aegis.verify(idToken, undefined, {
        typPresence: "optional",
      });

      expect(verified.format).toBe("jwt");
      expect(verified.claims.subject).toBe(SUBJECT);
    });

    test("reaches the JWT branch under the default explicit-typing policy", async () => {
      // RFC 8725 §3.11 explicit typing is aegis POLICY, opted out of above. The
      // point here is WHICH refusal arrives: a claims-layer `jwt_invalid_typ`
      // means the token was routed and read as a JWT, where the old
      // `unsupported_token_type` meant it was never recognised as a token.
      await expect(aegis.verify(idToken)).rejects.toMatchObject({
        // `typ_required` is the DOMAIN policy refusing an ABSENT typ. It is
        // deliberately not the kit's `jwt_invalid_typ`, which means the
        // opposite — a typ that is present and malformed.
        code: "typ_required",
      });
    });
  });

  describe("an RFC 9068 at+jwt access token", () => {
    test("is recognised as a JWT and a JWS", () => {
      expect(Aegis.isJwt(accessToken)).toBe(true);
      expect(Aegis.isJws(accessToken)).toBe(true);
    });

    test("parses and verifies through the claims branch", async () => {
      expect(aegis.parse(accessToken).claims.subject).toBe(SUBJECT);

      const verified = await aegis.verify(accessToken);

      expect(verified.format).toBe("jwt");
      expect(verified.claims.subject).toBe(SUBJECT);
    });
  });

  describe("a bare signed handle with no typ", () => {
    test("is a JWS but never a JWT", () => {
      expect(Aegis.isJws(opaqueJws)).toBe(true);
      expect(Aegis.isJwt(opaqueJws)).toBe(false);
    });

    test("verifies to the opaque jws branch with an empty domain", async () => {
      const verified = await aegis.verify(opaqueJws);

      expect(verified.format).toBe("jws");
      expect(verified.claims).toEqual({});
      expect(verified.raw?.toString()).toBe("opaque-handle");
    });

    test("is refused by the keyless claims reader, as an opaque token", () => {
      expect(() => aegis.parse(opaqueJws)).toThrow(
        expect.objectContaining({ code: "parse_requires_claims" }),
      );
    });
  });
});
