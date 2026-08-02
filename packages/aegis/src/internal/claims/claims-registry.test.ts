import { describe, expect, test } from "vitest";
import type { AegisProfile, AegisSensitive } from "../../types/index.js";
import { DOMAIN_CLAIM_KEYS } from "../utils/extract-claims.js";
import { CLAIMS_REGISTRY, claimByDomain, claimByJose } from "./claims-registry.js";

// Witness whose keys ARE the AegisSensitive field set. Typed as
// `Record<keyof AegisSensitive, true>`, so adding OR removing a field
// from AegisSensitive forces this to change (compile error) — the
// registry `sensitive` marks are then checked against these keys at runtime.
const SENSITIVE_IDENTITY_FIELDS: Record<keyof AegisSensitive, true> = {
  nationalIdentityNumber: true,
  nationalIdentityNumberVerified: true,
  socialSecurityNumber: true,
  socialSecurityNumberVerified: true,
};

// Witness whose keys ARE the AegisProfile field set. Typed as
// `Record<keyof AegisProfile, true>`, so adding OR removing a field from
// AegisProfile forces this to change (compile error) — the registry `profile`
// marks are then checked against these keys at runtime.
const PROFILE_FIELDS: Record<keyof AegisProfile, true> = {
  address: true,
  email: true,
  emailVerified: true,
  phoneNumber: true,
  phoneNumberVerified: true,
  picture: true,
  birthdate: true,
  familyName: true,
  gender: true,
  givenName: true,
  locale: true,
  middleName: true,
  name: true,
  nickname: true,
  preferredUsername: true,
  profile: true,
  updatedAt: true,
  website: true,
  zoneinfo: true,
  displayName: true,
  honorific: true,
  legalName: true,
  legalNameVerified: true,
  namingSystem: true,
  preferredAccessibility: true,
  preferredName: true,
  pronouns: true,
  department: true,
  jobTitle: true,
  occupation: true,
  organization: true,
};

describe("CLAIM_REGISTRY", () => {
  test("every domain claim from extract-claims FIELD_KEYS is in the registry", () => {
    for (const domain of Object.keys(DOMAIN_CLAIM_KEYS)) {
      expect(
        claimByDomain(domain),
        `missing registry entry for "${domain}"`,
      ).toBeDefined();
    }
  });

  test("where a registry claim is also extracted, its jose name matches extract-claims (no drift)", () => {
    // The registry is a SUPERSET of extract-claims: it also covers SET claims
    // (sub_id/events/txn) that mint emits but parsing does not extract. For the
    // overlapping claims, the jose name must agree with extract-claims.
    for (const spec of CLAIMS_REGISTRY) {
      const acceptedNames = DOMAIN_CLAIM_KEYS[spec.domain];
      if (acceptedNames === undefined) continue; // SET-only claim, not extracted
      expect(
        acceptedNames.includes(spec.jose),
        `registry jose "${spec.jose}" not in extract-claims keys for "${spec.domain}"`,
      ).toBe(true);
    }
  });

  test("domain names are unique", () => {
    const domains = CLAIMS_REGISTRY.map((s) => s.domain);
    expect(new Set(domains).size).toBe(domains.length);
  });

  test("jose names are unique", () => {
    const jose = CLAIMS_REGISTRY.map((s) => s.jose);
    expect(new Set(jose).size).toBe(jose.length);
  });

  test("cose labels are unique where present", () => {
    const labels = CLAIMS_REGISTRY.map((s) => s.cose).filter(
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
    for (const spec of CLAIMS_REGISTRY) {
      if (spec.cose === null || spec.cose >= -65536) continue;
      expect(
        spec.jose.length,
        `${spec.domain} (${spec.jose}) is integer-keyed but ≤ 4 chars`,
      ).toBeGreaterThanOrEqual(5);
    }
  });

  test("every non-registered short claim (JOSE name ≤ 4 chars) is string-keyed (cose:null)", () => {
    for (const spec of CLAIMS_REGISTRY) {
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
    for (const spec of CLAIMS_REGISTRY) {
      if (spec.cose === null || spec.cose < -65536) continue;
      expect(spec.cose).toBeGreaterThanOrEqual(-65536);
    }
  });

  test("standards-based assurance levels are string-keyed (cose:null)", () => {
    for (const domain of STANDARDS_BASED_ASSURANCE) {
      const spec = claimByDomain(domain);
      expect(spec?.cose, `${domain} must be string-keyed`).toBeNull();
    }
  });

  test("the standard CWT labels are correct (RFC 8392 / IANA)", () => {
    expect(claimByDomain("issuer")?.cose).toBe(1);
    expect(claimByDomain("subject")?.cose).toBe(2);
    expect(claimByDomain("audience")?.cose).toBe(3);
    expect(claimByDomain("expiresAt")?.cose).toBe(4);
    expect(claimByDomain("notBefore")?.cose).toBe(5);
    expect(claimByDomain("issuedAt")?.cose).toBe(6);
    expect(claimByDomain("tokenId")?.cose).toBe(7); // cti
    expect(claimByDomain("confirmation")?.cose).toBe(8);
    expect(claimByDomain("scope")?.cose).toBe(9);
  });

  test("OIDC nonce is NOT mapped to CWT label 10 (eat_nonce)", () => {
    // nonce has no registered CWT label; its name is ≥ 5 chars so it gets a
    // private-use label, but never the registered EAT label 10.
    expect(claimByDomain("nonce")?.cose).not.toBe(10);
    expect(CLAIMS_REGISTRY.some((spec) => spec.cose === 10)).toBe(false);
  });

  test("coseName is present exactly for the JOSE↔COSE name divergences (RFC 8392: jti↔cti)", () => {
    // A coseName, where present, must actually diverge from the JOSE name —
    // absence means "COSE name == JOSE name" (the common case), so a coseName
    // equal to jose would be a redundant, wrong entry.
    for (const spec of CLAIMS_REGISTRY) {
      if (spec.coseName === undefined) continue;
      expect(
        spec.coseName,
        `${spec.domain} coseName "${spec.coseName}" must differ from jose "${spec.jose}"`,
      ).not.toBe(spec.jose);
    }

    // The FULL divergence set, derived from the registry and grounded in RFC
    // 8392's registered CWT claim names: today the only JOSE↔COSE name
    // divergence is jti↔cti. Adding a wrong/extra coseName fails here.
    const divergences = CLAIMS_REGISTRY.filter(
      (spec) => spec.coseName && spec.coseName !== spec.jose,
    ).map((spec) => ({ domain: spec.domain, jose: spec.jose, coseName: spec.coseName }));

    expect(divergences).toEqual([{ domain: "tokenId", jose: "jti", coseName: "cti" }]);
  });

  test('category "sensitive" claims match the AegisSensitive field set', () => {
    const sensitiveDomains = CLAIMS_REGISTRY.filter(
      (spec) => spec.category === "sensitive",
    ).map((spec) => spec.domain);

    expect(new Set(sensitiveDomains)).toEqual(
      new Set(Object.keys(SENSITIVE_IDENTITY_FIELDS)),
    );
  });

  test('category "profile" claims match the AegisProfile field set', () => {
    const profileDomains = CLAIMS_REGISTRY.filter(
      (spec) => spec.category === "profile",
    ).map((spec) => spec.domain);

    expect(new Set(profileDomains)).toEqual(new Set(Object.keys(PROFILE_FIELDS)));
  });

  test('the "array" read-split marks are populated exactly (spaced vs strict)', () => {
    const spaced = CLAIMS_REGISTRY.filter((s) => s.array === "spaced").map(
      (s) => s.domain,
    );
    const strict = CLAIMS_REGISTRY.filter((s) => s.array === "strict").map(
      (s) => s.domain,
    );

    expect(new Set(spaced)).toEqual(
      new Set(["scope", "roles", "permissions", "conformsTo"]),
    );
    expect(new Set(strict)).toEqual(
      new Set([
        "authMethods",
        "authFactorCategories",
        "entitlements",
        "groups",
        "preferredAccessibility",
      ]),
    );
  });

  test('the "array" mark is on value:"array" claims only, and every one except audience declares it', () => {
    for (const spec of CLAIMS_REGISTRY) {
      if (spec.array === undefined) continue;
      expect(
        spec.value,
        `${spec.domain} has an array mark but is not value:"array"`,
      ).toBe("array");
    }
    for (const spec of CLAIMS_REGISTRY) {
      if (spec.value !== "array") continue;
      if (spec.domain === "audience") {
        // RFC 7519 aud is string-OR-array — its own decoder, no read-split mark.
        expect(spec.array, "audience must not carry an array mark").toBeUndefined();
        continue;
      }
      expect(
        spec.array,
        `${spec.domain} (value:"array") must declare a read-split mark`,
      ).toBeDefined();
    }
  });

  test("the temporal claim set + directions are populated exactly", () => {
    const temporal = CLAIMS_REGISTRY.filter((s) => s.temporal !== undefined).map((s) => ({
      domain: s.domain,
      direction: s.temporal,
    }));

    // Order is registry declaration order (exp, nbf, iat, auth_time).
    expect(temporal).toEqual([
      { domain: "expiresAt", direction: "future" },
      { domain: "notBefore", direction: "past" },
      { domain: "issuedAt", direction: "past" },
      { domain: "authTime", direction: "past" },
    ]);
  });

  test('a temporal mark implies value:"date"; updatedAt is date but NOT temporal', () => {
    for (const spec of CLAIMS_REGISTRY) {
      if (spec.temporal === undefined) continue;
      expect(spec.value, `${spec.domain} is temporal but not value:"date"`).toBe("date");
    }
    expect(claimByDomain("updatedAt")?.value).toBe("date");
    expect(claimByDomain("updatedAt")?.temporal).toBeUndefined();
  });

  test("every entry declares exactly one category", () => {
    const valid = new Set(["claims", "profile", "sensitive"]);
    for (const spec of CLAIMS_REGISTRY) {
      expect(valid.has(spec.category), `${spec.domain} has invalid category`).toBe(true);
    }
  });

  test("lookups resolve by domain and jose", () => {
    expect(claimByDomain("issuer")?.jose).toBe("iss");
    expect(claimByJose("iss")?.domain).toBe("issuer");
  });

  test("every COSE label is a registered integer or a private-use label", () => {
    // The IANA CWT allocation policy: registered labels are positive; the
    // lindorm private-use labels are < -65536. The reserved specification-required
    // band in between is never squatted. (A `null` cose is string-keyed.)
    for (const spec of CLAIMS_REGISTRY) {
      if (spec.cose === null) continue;
      expect(spec.cose > 0 || spec.cose < -65536).toBe(true);
    }
  });

  // --- Bespoke sub-kind drift guards ---------------------------------------

  test('the "bespoke" sub-kind mark is present iff value === "bespoke"', () => {
    for (const spec of CLAIMS_REGISTRY) {
      expect(
        spec.bespoke !== undefined,
        `${spec.domain}: bespoke mark must be present iff value:"bespoke"`,
      ).toBe(spec.value === "bespoke");
    }
  });

  test("every bespoke claim maps to its frozen sub-kind (builder)", () => {
    // Frozen domain -> sub-kind mapping: claims sharing a builder share a
    // sub-kind (act+mayAct -> "act", the three OIDC hashes -> "hash"). A future
    // registry edit that re-routes a claim to a different builder fails here.
    const FROZEN_BESPOKE: Record<string, string> = {
      confirmation: "confirmation",
      act: "act",
      mayAct: "act",
      accessTokenHash: "hash",
      codeHash: "hash",
      stateHash: "hash",
      authorizationDetails: "authDetails",
      subjectId: "subId",
      events: "events",
      address: "address",
    };

    const actual = Object.fromEntries(
      CLAIMS_REGISTRY.filter((spec) => spec.bespoke !== undefined).map((spec) => [
        spec.domain,
        spec.bespoke,
      ]),
    );

    expect(actual).toEqual(FROZEN_BESPOKE);
  });

  test("HASH_DOMAINS / ACT_DOMAINS derive from the registry to their frozen sets", () => {
    // cwt-spec.ts derives these two COSE byte-shaping sets from the `bespoke`
    // sub-kind. Freeze the previously-hardcoded literals and assert the
    // registry-derived sets still equal them (byte-shaping must not drift).
    const FROZEN_HASH_DOMAINS = ["accessTokenHash", "codeHash", "stateHash"];
    const FROZEN_ACT_DOMAINS = ["act", "mayAct"];

    const hashDomains = CLAIMS_REGISTRY.filter((spec) => spec.bespoke === "hash").map(
      (spec) => spec.domain,
    );
    const actDomains = CLAIMS_REGISTRY.filter((spec) => spec.bespoke === "act").map(
      (spec) => spec.domain,
    );

    expect(new Set(hashDomains)).toEqual(new Set(FROZEN_HASH_DOMAINS));
    expect(new Set(actDomains)).toEqual(new Set(FROZEN_ACT_DOMAINS));
  });

  // --- Subset-membership drift guards --------------------------------------

  test("the three extraction subsets derive to their frozen membership", () => {
    // Freeze the previously-hardcoded FIELD_KEYS / RFC8693_KEYS / POP_KEYS from
    // extract-claims.ts. DOMAIN_CLAIM_KEYS is now DERIVED from the registry's
    // `subset` marks; asserting it equals the frozen merge proves the derivation
    // is byte-identical to the old hand-maintained lists (both key sets AND the
    // per-claim accepted-name arrays, in [domain, jose] order).
    const FROZEN_FIELD_KEYS: Record<string, ReadonlyArray<string>> = {
      subject: ["subject", "sub"],
      expiresAt: ["expiresAt", "exp"],
      issuedAt: ["issuedAt", "iat"],
      notBefore: ["notBefore", "nbf"],
      issuer: ["issuer", "iss"],
      audience: ["audience", "aud"],
      tokenId: ["tokenId", "jti"],
      accessTokenHash: ["accessTokenHash", "at_hash"],
      authContextClassReference: ["authContextClassReference", "acr"],
      authMethods: ["authMethods", "amr"],
      authorizedParty: ["authorizedParty", "azp"],
      authTime: ["authTime", "auth_time"],
      codeHash: ["codeHash", "c_hash"],
      nonce: ["nonce"],
      stateHash: ["stateHash", "s_hash"],
      vectorOfTrust: ["vectorOfTrust", "vot"],
      vectorTrustMark: ["vectorTrustMark", "vtm"],
      entitlements: ["entitlements"],
      groups: ["groups"],
      roles: ["roles"],
      authorizationDetails: ["authorizationDetails", "authorization_details"],
      authenticatorAssuranceLevel: ["authenticatorAssuranceLevel", "aal"],
      authFactorCategories: ["authFactorCategories", "afc"],
      authFactorReference: ["authFactorReference", "afr"],
      clientId: ["clientId", "client_id"],
      conformsTo: ["conformsTo", "conforms_to"],
      federationAssuranceLevel: ["federationAssuranceLevel", "fal"],
      grantType: ["grantType", "gty"],
      identityAssuranceLevel: ["identityAssuranceLevel", "ial"],
      levelOfAssurance: ["levelOfAssurance", "loa"],
      permissions: ["permissions"],
      scope: ["scope"],
      sessionHint: ["sessionHint", "sih"],
      sessionId: ["sessionId", "sid"],
      subjectHint: ["subjectHint", "suh"],
      tenantId: ["tenantId", "tenant_id"],
      subjectId: ["subjectId", "sub_id"],
    };
    const FROZEN_RFC8693_KEYS: Record<string, ReadonlyArray<string>> = {
      act: ["act"],
      mayAct: ["mayAct", "may_act"],
    };
    const FROZEN_POP_KEYS: Record<string, ReadonlyArray<string>> = {
      confirmation: ["confirmation", "cnf"],
    };

    expect(DOMAIN_CLAIM_KEYS).toEqual({
      ...FROZEN_FIELD_KEYS,
      ...FROZEN_RFC8693_KEYS,
      ...FROZEN_POP_KEYS,
    });

    // The disjoint `subset` marks partition those domains exactly as the frozen
    // lists group them (registry-side view of the same fact).
    const domainsWithSubset = (subset: string) =>
      new Set(
        CLAIMS_REGISTRY.filter((spec) => spec.subset === subset).map(
          (spec) => spec.domain,
        ),
      );
    expect(domainsWithSubset("core")).toEqual(new Set(Object.keys(FROZEN_FIELD_KEYS)));
    expect(domainsWithSubset("rfc8693")).toEqual(
      new Set(Object.keys(FROZEN_RFC8693_KEYS)),
    );
    expect(domainsWithSubset("pop")).toEqual(new Set(Object.keys(FROZEN_POP_KEYS)));
  });
});
