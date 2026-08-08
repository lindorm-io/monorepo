// RFC 7662 §2.2 `username` is a REGISTERED domain claim: an authorization server
// that can report a username about a token means the token itself can carry one.
// It is deliberately NOT the OIDC Core §5.1 `preferred_username` profile claim —
// the two are separate registry entries and neither shadows the other.
//
// A registered claim must be mintable through a real profile, not only through the
// policy-free `default` tier — otherwise it can arrive only by introspection, which is
// the one-path asymmetry registering it removed. `AccessTokenContent` therefore picks
// it: RFC 7662 introspects an ACCESS token, so the claim an introspection answer may
// report about one is a claim that token may assert about itself.
//
// `IdTokenContent` deliberately does NOT pick it. OIDC Core §5.1 gives id tokens
// `preferred_username`, which is already registered and already reachable there
// through the `profile` container. The two stay distinct.

import { Amphora, type IAmphora } from "@lindorm/amphora";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, expectTypeOf, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import type { AccessTokenContent, IdTokenContent } from "../types/index.js";
import { Aegis } from "./Aegis.js";
import { JwtKit } from "./JwtKit.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";
const RESOURCE = "https://rs.lindorm.io/";

describe("Aegis username claim", () => {
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

  describe("mint and verify", () => {
    test("should carry username on the wire under its own name and back to the domain", async () => {
      const { token } = await aegis.mint("default", {
        subject: "user-1",
        audience: [RESOURCE],
        expires: "1 hour",
        tokenType: "access_token",
        username: "alice@lindorm.io",
      });

      const { payload } = JwtKit.decode(token);
      expect(payload.username).toBe("alice@lindorm.io");

      const verified = await aegis.verify(token, { audience: RESOURCE });

      expect(verified.claims.username).toBe("alice@lindorm.io");
      // A registered claim never reaches the custom bucket.
      expect(verified.custom).not.toHaveProperty("username");
    });

    test("should leave username absent when the token carries none", async () => {
      const { token } = await aegis.mint("default", {
        subject: "user-1",
        audience: [RESOURCE],
        expires: "1 hour",
        tokenType: "access_token",
      });

      const verified = await aegis.verify(token, { audience: RESOURCE });

      expect(verified.claims).not.toHaveProperty("username");
      expect(verified.custom).not.toHaveProperty("username");
    });

    // The naming trap: `username` (RFC 7662 §2.2) and `preferred_username`
    // (OIDC Core §5.1) are DIFFERENT claims. Both registered, neither shadowing.
    test("should round-trip username and preferredUsername independently", async () => {
      const { token } = await aegis.mint("default", {
        subject: "user-1",
        audience: [RESOURCE],
        expires: "1 hour",
        tokenType: "id_token",
        username: "alice@lindorm.io",
        profile: { preferredUsername: "Alice" },
      });

      const { payload } = JwtKit.decode(token);
      expect(payload.username).toBe("alice@lindorm.io");
      expect(payload.preferred_username).toBe("Alice");

      const verified = await aegis.verify(token, { audience: RESOURCE });

      // `username` is a CLAIM; `preferredUsername` is a PROFILE field. They land
      // in different buckets and neither is in `custom`.
      expect(verified.claims.username).toBe("alice@lindorm.io");
      expect(verified.profile?.preferredUsername).toBe("Alice");
      expect(verified.claims).not.toHaveProperty("preferredUsername");
      expect(verified.custom).toEqual({});
    });
  });

  // The access token is the artifact RFC 7662 introspects, so it is the profile that
  // must be able to assert the claim itself. Minting it here — not only through
  // `default` — is what keeps the payload and introspection provenances symmetric.
  describe("access_token profile", () => {
    // A `Pick` is the compiler's record of what a token may usefully assert, so the
    // split is asserted at the type level too: an inline `mint` literal would
    // otherwise fall through to the profile-UNAWARE overload
    // (`mint(string & {}, SignContent)`) and type-check for the wrong reason,
    // silently dropping every access_token-specific rule for that call.
    test("should admit username on AccessTokenContent but not on IdTokenContent", () => {
      expectTypeOf<AccessTokenContent>().toHaveProperty("username");
      expectTypeOf<IdTokenContent>().not.toHaveProperty("username");
    });

    test("should carry username on a minted access token and back to the domain", async () => {
      const { token } = await aegis.mint("access_token", {
        subject: "user-1",
        audience: [RESOURCE],
        clientId: "client-1",
        username: "alice@lindorm.io",
      });

      const { payload } = JwtKit.decode(token);
      expect(payload.username).toBe("alice@lindorm.io");
      // Never silently rewritten into the OIDC profile claim.
      expect(payload).not.toHaveProperty("preferred_username");

      const verified = await aegis.verify(token, { audience: RESOURCE });

      expect(verified.claims.username).toBe("alice@lindorm.io");
      expect(verified.custom).not.toHaveProperty("username");
      expect(verified.profile ?? {}).not.toHaveProperty("preferredUsername");
    });

    test("should leave username absent when the access token carries none", async () => {
      const { token } = await aegis.mint("access_token", {
        subject: "user-1",
        audience: [RESOURCE],
        clientId: "client-1",
      });

      const verified = await aegis.verify(token, { audience: RESOURCE });

      expect(verified.claims).not.toHaveProperty("username");
      expect(verified.custom).not.toHaveProperty("username");
    });

    test("should round-trip username through the COSE wire on the access_token profile", async () => {
      const { token } = await aegis.mint(
        "access_token",
        {
          subject: "user-1",
          audience: [RESOURCE],
          clientId: "client-1",
          username: "alice@lindorm.io",
        },
        { format: "cwt" },
      );

      const verified = await aegis.verify(token, { audience: RESOURCE });

      expect(verified.format).toBe("cwt");
      expect(verified.claims.username).toBe("alice@lindorm.io");
      expect(verified.custom).not.toHaveProperty("username");
    });
  });

  describe("toDomain", () => {
    test("should route both usernames out of the custom bucket", () => {
      const { claims, custom } = Aegis.toDomain({
        sub: "user-1",
        username: "alice@lindorm.io",
        preferred_username: "Alice",
      });

      expect(claims.username).toBe("alice@lindorm.io");
      expect(claims.preferredUsername).toBe("Alice");
      expect(custom).toEqual({});
    });

    test("should yield neither username when the input carries neither", () => {
      const { claims, custom } = Aegis.toDomain({ sub: "user-1" });

      expect(claims).not.toHaveProperty("username");
      expect(claims).not.toHaveProperty("preferredUsername");
      expect(custom).toEqual({});
    });
  });

  describe("toWire", () => {
    test("should emit username unchanged and preferredUsername as preferred_username", () => {
      const wire = Aegis.toWire({
        username: "alice@lindorm.io",
        preferredUsername: "Alice",
      });

      expect(wire).toEqual({
        username: "alice@lindorm.io",
        preferred_username: "Alice",
      });
    });
  });

  describe("cwt", () => {
    test("should round-trip username through the COSE wire", async () => {
      const { token } = await aegis.mint(
        "default",
        {
          subject: "user-1",
          audience: [RESOURCE],
          expires: "1 hour",
          tokenType: "access_token",
          username: "alice@lindorm.io",
        },
        { format: "cwt" },
      );

      const verified = await aegis.verify(token, { audience: RESOURCE });

      expect(verified.format).toBe("cwt");
      expect(verified.claims.username).toBe("alice@lindorm.io");
      expect(verified.custom).not.toHaveProperty("username");
    });

    // `username` is 8 chars, so the byte-size rule gives it a private-use integer
    // label — an on-platform encoding a stock CWT verifier cannot read. Off
    // platform it must degrade to its JOSE string key, never be dropped.
    test("should degrade to the string key off-platform and still round-trip", async () => {
      const { token } = await aegis.mint(
        "default",
        {
          subject: "user-1",
          audience: [RESOURCE],
          expires: "1 hour",
          tokenType: "access_token",
          username: "alice@lindorm.io",
        },
        { format: "cwt", proprietary: false },
      );

      const verified = await aegis.verify(token, { audience: RESOURCE });

      expect(verified.wire?.payload?.username).toBe("alice@lindorm.io");
      expect(verified.claims.username).toBe("alice@lindorm.io");
    });
  });
});
