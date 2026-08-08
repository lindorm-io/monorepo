// RFC 7662 §2.2 `username` is a REGISTERED domain claim: an authorization server
// that can report a username about a token means the token itself can carry one.
// It is deliberately NOT the OIDC Core §5.1 `preferred_username` profile claim —
// the two are separate registry entries and neither shadows the other.
//
// The `default` profile is the policy-free tier, so it is what these mint through:
// the conformance profiles (`access_token`, `id_token`) curate their content picks
// from the RFCs they implement, and RFC 9068 / OIDC Core do not define `username`.

import { Amphora, type IAmphora } from "@lindorm/amphora";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
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
