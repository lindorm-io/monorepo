import { describe, expect, test } from "vitest";
import type { Direction, ProfileContentFor, TokenProfile } from "../../types/index.js";
import { createProfileRegistry } from "./registry.js";

const resolveProfile = (name: string): TokenProfile =>
  createProfileRegistry().resolve(name);

/** The claims a profile REQUIRES in a given direction, read off its policy. */
const requiredClaims = (profile: TokenProfile, direction: Direction): Array<string> => {
  const claims: Array<string> = [];

  for (const rule of profile.policy) {
    if (rule.rule !== "required") continue;
    if (!(rule.on as ReadonlyArray<Direction>).includes(direction)) continue;
    claims.push(...rule.claims);
  }

  return claims;
};

/**
 * Drift guard: the domain keys a profile's *Content type marks as REQUIRED
 * must each map to a wire claim present in the descriptor's `required` floor.
 * If the two drift apart (a content type requires something the descriptor
 * does not enforce, or vice-versa), a token could type-check yet fail at mint,
 * or pass mint with a hole the types claim is closed. The mapping below mirrors
 * the Pick<...> in types/jwt/profile.ts; update both together.
 */
const REQUIRED_DOMAIN_KEYS: Record<string, Array<string>> = {
  access_token: ["subject", "audience", "clientId"],
  id_token: ["subject", "audience"],
  logout_token: ["audience", "events"],
  erasure_token: ["audience", "subject", "events"],
  security_event: ["audience", "subjectId", "events"],
  delegation: ["issuer", "subject", "audience"],
  introspection: ["audience"],
  userinfo: ["subject", "audience"],
  jarm: ["audience"],
};

describe("profile content/descriptor drift guard", () => {
  for (const [name, domainKeys] of Object.entries(REQUIRED_DOMAIN_KEYS)) {
    test(`${name}: every required domain key is enforced by the descriptor`, () => {
      const profile = resolveProfile(name);

      for (const domainKey of domainKeys) {
        // Both directions: a content type's required key that the descriptor
        // only enforced at mint would be a guarantee the verify side never makes.
        expect(requiredClaims(profile, "mint")).toContain(domainKey);
        expect(requiredClaims(profile, "verify")).toContain(domainKey);
      }
    });
  }
});

// The auto-injectable envelope claims, by DOMAIN name. A descriptor must never
// name a WIRE claim here (the old `{ iat; jti; nbf; iss }` object leaked wire
// names into the profile surface); the mint pipeline maps these to their wire
// claims via the ONE translator.
const AUTO_INJECTABLE = new Set(["issuedAt", "tokenId", "notBefore", "issuer"]);
const WIRE_LEAK = new Set(["iat", "jti", "nbf", "iss"]);

describe("autoInject is domain-named (no wire-name leak)", () => {
  for (const name of Object.keys(REQUIRED_DOMAIN_KEYS).concat("default")) {
    test(`${name}: every autoInject entry is a domain AutoInjectableClaim`, () => {
      const profile = resolveProfile(name);

      expect(Array.isArray(profile.autoInject)).toBe(true);

      for (const claim of profile.autoInject) {
        expect(AUTO_INJECTABLE.has(claim)).toBe(true);
        expect(WIRE_LEAK.has(claim)).toBe(false);
      }
    });
  }
});

/**
 * The DIRECTION every built-in declares. `"both"` is the behaviour-preserving
 * answer and the default, so this table is really a list of the ONE profile
 * deliberately narrowed — `external_access_token`, which exists to verify a
 * token another authorization server issued.
 *
 * Everything else is genuinely two-sided: an `introspection` (RFC 9701 §5) or
 * `userinfo` (OIDC Core §5.3.2) response is a signed JWT the RECIPIENT
 * validates, a `jarm` response is validated by the client, a `logout_token` by
 * the RP (Back-Channel Logout §2.6), a `security_event` by the SSF receiver.
 * Narrowing any of them would break a consumer silently, so none is narrowed on
 * a guess.
 */
const PROFILE_USE: Record<string, "mint" | "verify" | "both"> = {
  access_token: "both",
  default: "both",
  delegation: "both",
  erasure_token: "both",
  external_access_token: "verify",
  id_token: "both",
  introspection: "both",
  jarm: "both",
  logout_token: "both",
  security_event: "both",
  userinfo: "both",
};

describe("profile use direction", () => {
  for (const [name, use] of Object.entries(PROFILE_USE)) {
    test(`${name}: declares use "${use}"`, () => {
      expect(resolveProfile(name).use).toBe(use);
    });
  }
});

/**
 * The TYPE-level half must agree with the runtime one: a verify-only profile's
 * mint content resolves to `never`, so the call site fails to compile as well
 * as to run. A `both` profile keeps its own content type.
 */
type Assert<T extends true> = T;
type _VerifyOnlyMintsNothing = Assert<
  [ProfileContentFor<"external_access_token">] extends [never] ? true : false
>;
type _BothStillMints = Assert<
  [ProfileContentFor<"access_token">] extends [never] ? false : true
>;
