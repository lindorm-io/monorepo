import { describe, expect, test } from "vitest";
import { resolveProfile } from "./registry.js";

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
  client_assertion: ["issuer", "subject", "audience"],
  introspection: ["audience"],
  userinfo: ["subject", "audience"],
  jarm: ["audience"],
};

describe("profile content/descriptor drift guard", () => {
  for (const [name, domainKeys] of Object.entries(REQUIRED_DOMAIN_KEYS)) {
    test(`${name}: every required domain key is enforced by the descriptor`, () => {
      const profile = resolveProfile(name);

      for (const domainKey of domainKeys) {
        expect(profile.required).toContain(domainKey);
      }
    });
  }
});
