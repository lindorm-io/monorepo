import { describe, expect, test } from "vitest";
import { DOMAIN_CLAIM_KEYS } from "../utils/extract-claims.js";
import { CLAIM_REGISTRY, specByCose, specByDomain, specByJose } from "./registry.js";

describe("CLAIM_REGISTRY", () => {
  test("every domain claim from extract-claims FIELD_KEYS is in the registry", () => {
    for (const domain of Object.keys(DOMAIN_CLAIM_KEYS)) {
      expect(
        specByDomain(domain),
        `missing registry entry for "${domain}"`,
      ).toBeDefined();
    }
  });

  test("where a registry claim is also extracted, its jose name matches extract-claims (no drift)", () => {
    // The registry is a SUPERSET of extract-claims: it also covers SET claims
    // (sub_id/events/txn) that mint emits but parsing does not extract. For the
    // overlapping claims, the jose name must agree with extract-claims.
    for (const spec of CLAIM_REGISTRY) {
      const acceptedNames = DOMAIN_CLAIM_KEYS[spec.domain];
      if (acceptedNames === undefined) continue; // SET-only claim, not extracted
      expect(
        acceptedNames.includes(spec.jose),
        `registry jose "${spec.jose}" not in extract-claims keys for "${spec.domain}"`,
      ).toBe(true);
    }
  });

  test("domain names are unique", () => {
    const domains = CLAIM_REGISTRY.map((s) => s.domain);
    expect(new Set(domains).size).toBe(domains.length);
  });

  test("jose names are unique", () => {
    const jose = CLAIM_REGISTRY.map((s) => s.jose);
    expect(new Set(jose).size).toBe(jose.length);
  });

  test("cose labels are unique where present", () => {
    const labels = CLAIM_REGISTRY.map((s) => s.cose).filter(
      (c): c is number => c !== null,
    );
    expect(new Set(labels).size).toBe(labels.length);
  });

  test("proprietary claims use private-use labels (< -65536); standard claims do not", () => {
    for (const spec of CLAIM_REGISTRY) {
      if (spec.proprietary) {
        expect(
          spec.cose,
          `${spec.domain} proprietary but not private-use`,
        ).not.toBeNull();
        expect(spec.cose as number).toBeLessThan(-65536);
      } else if (spec.cose !== null) {
        // non-proprietary registered labels are the standard CWT range (>= -65536)
        expect(spec.cose).toBeGreaterThanOrEqual(-65536);
      }
    }
  });

  test("the standard CWT labels are correct (RFC 8392 / IANA)", () => {
    expect(specByDomain("issuer")?.cose).toBe(1);
    expect(specByDomain("subject")?.cose).toBe(2);
    expect(specByDomain("audience")?.cose).toBe(3);
    expect(specByDomain("expiresAt")?.cose).toBe(4);
    expect(specByDomain("notBefore")?.cose).toBe(5);
    expect(specByDomain("issuedAt")?.cose).toBe(6);
    expect(specByDomain("tokenId")?.cose).toBe(7); // cti
    expect(specByDomain("confirmation")?.cose).toBe(8);
    expect(specByDomain("scope")?.cose).toBe(9);
  });

  test("OIDC nonce is NOT mapped to CWT label 10 (eat_nonce)", () => {
    expect(specByDomain("nonce")?.cose).toBeNull();
    expect(specByCose(10)).toBeUndefined();
  });

  test("lookups resolve by domain, jose, and cose", () => {
    expect(specByDomain("issuer")?.jose).toBe("iss");
    expect(specByJose("iss")?.domain).toBe("issuer");
    expect(specByCose(1)?.domain).toBe("issuer");
  });
});
