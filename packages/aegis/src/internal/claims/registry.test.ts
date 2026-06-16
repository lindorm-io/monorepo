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

  // Standards-based assurance axes: a standard meaning but NO registered CWT
  // label, and short JOSE names (≤ 4 chars), so they are string-keyed (cose:null).
  const STANDARDS_BASED_ASSURANCE = [
    "levelOfAssurance",
    "authenticatorAssuranceLevel",
    "identityAssuranceLevel",
    "federationAssuranceLevel",
  ];

  // The byte-size rule: a private-use label is 5 bytes; an N-char string key is
  // N + 1 bytes; so the integer is chosen only when it saves bytes (name ≥ 5).
  test("every private-use label (< -65536) has a JOSE name of length ≥ 5", () => {
    for (const spec of CLAIM_REGISTRY) {
      if (spec.cose === null || spec.cose >= -65536) continue;
      expect(
        spec.jose.length,
        `${spec.domain} (${spec.jose}) is integer-keyed but ≤ 4 chars`,
      ).toBeGreaterThanOrEqual(5);
    }
  });

  test("every non-registered short claim (JOSE name ≤ 4 chars) is string-keyed (cose:null)", () => {
    for (const spec of CLAIM_REGISTRY) {
      // Registered standard CWT labels (1–9) are exempt from the byte-size rule.
      if (spec.cose !== null && spec.cose >= -65536) continue;
      if (spec.jose.length > 4) continue;
      expect(
        spec.cose,
        `${spec.domain} (${spec.jose}) is ≤ 4 chars but not string-keyed`,
      ).toBeNull();
    }
  });

  test("registered labels (not private-use) are in the standard CWT range", () => {
    for (const spec of CLAIM_REGISTRY) {
      if (spec.cose === null || spec.cose < -65536) continue;
      expect(spec.cose).toBeGreaterThanOrEqual(-65536);
    }
  });

  test("standards-based assurance levels are string-keyed (cose:null)", () => {
    for (const domain of STANDARDS_BASED_ASSURANCE) {
      const spec = specByDomain(domain);
      expect(spec?.cose, `${domain} must be string-keyed`).toBeNull();
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
    // nonce has no registered CWT label; its name is ≥ 5 chars so it gets a
    // private-use label, but never the registered EAT label 10.
    expect(specByDomain("nonce")?.cose).not.toBe(10);
    expect(specByCose(10)).toBeUndefined();
  });

  test("lookups resolve by domain, jose, and cose", () => {
    expect(specByDomain("issuer")?.jose).toBe("iss");
    expect(specByJose("iss")?.domain).toBe("issuer");
    expect(specByCose(1)?.domain).toBe("issuer");
  });
});
