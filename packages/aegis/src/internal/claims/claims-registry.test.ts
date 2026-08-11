import {
  isArray,
  isBoolean,
  isBuffer,
  isDate,
  isFinite,
  isObject,
  isString,
} from "@lindorm/is";
import { describe, expect, test } from "vitest";
import type { AegisProfile, AegisSensitive } from "../../types/index.js";
import type { BespokeKind, ClaimCodec } from "../registry/claim-spec.js";
import { codecFor } from "../registry/param-spec.js";
import { WIRE_TAGS } from "../registry/wire.js";
import { DOMAIN_CLAIM_KEYS } from "../utils/extract-claims.js";
import {
  CLAIM_SPECS,
  CLAIMS_REGISTRY,
  claimByCose,
  claimByCoseName,
  claimByDomain,
  claimByJose,
  coseLabel,
  coseName,
  joseName,
} from "./claims-registry.js";

// Witness whose keys ARE the AegisSensitive field set. Typed as
// `Record<keyof AegisSensitive, true>`, so adding OR removing a field
// from AegisSensitive forces this to change (compile error) — the
// registry `sensitivity` marks are then checked against these keys at runtime.
const SENSITIVE_IDENTITY_FIELDS: Record<keyof AegisSensitive, true> = {
  nationalIdentityNumber: true,
  nationalIdentityNumberVerified: true,
  socialSecurityNumber: true,
  socialSecurityNumberVerified: true,
};

// Witness whose keys ARE the AegisProfile field set. Typed as
// `Record<keyof AegisProfile, true>`, so adding OR removing a field from
// AegisProfile forces this to change (compile error) — the registry `bucket`
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

/** A readable name for a codec, so a shape failure says WHICH kind was expected. */
const describeCodec = (codec: ClaimCodec): string =>
  codec.kind === "bespoke" ? `bespoke/${codec.bespoke}` : codec.kind;

/**
 * Does a `sample` carry the DOMAIN shape its codec kind implies? Both switches
 * are exhaustive with a `never` default, so a new {@link ClaimCodec} kind or a
 * new {@link BespokeKind} cannot be added without stating the shape it samples.
 */
const sampleMatchesCodec = (codec: ClaimCodec, sample: unknown): boolean => {
  switch (codec.kind) {
    case "text":
      return isString(sample);
    case "int":
      return isFinite(sample);
    case "date":
      return isDate(sample);
    case "bool":
      return isBoolean(sample);
    case "bstr":
      // A byte string is a b64url STRING in the domain form and Buffer bytes on
      // the COSE wire; no claim carries `bstr` as its BASE codec today.
      return isString(sample) || isBuffer(sample);
    case "array":
      return isArray(sample) && sample.every(isString);
    case "bespoke":
      return sampleMatchesBespoke(codec.bespoke, sample);
    default: {
      const exhaustive: never = codec;
      throw new Error(`Unhandled claim codec kind: ${(exhaustive as ClaimCodec).kind}`);
    }
  }
};

const sampleMatchesBespoke = (bespoke: BespokeKind, sample: unknown): boolean => {
  switch (bespoke) {
    case "hash":
      // The OIDC hashes are already-derived b64url strings.
      return isString(sample);
    case "confirmation":
    case "act":
    case "subId":
    case "events":
    case "address":
      return isObject(sample);
    case "authDetails":
      // RFC 9396 authorization_details is an ARRAY of objects.
      return isArray(sample) && sample.every(isObject);
    default: {
      const exhaustive: never = bespoke;
      throw new Error(`Unhandled bespoke claim sub-kind: ${String(exhaustive)}`);
    }
  }
};

describe("CLAIM_REGISTRY", () => {
  // --- shared ParamSpec base ------------------------------------------------

  test("the registry declares claims an OPEN set", () => {
    // The one thing that separates the claim registry from the header one, and
    // the reason an unregistered key becomes a custom claim rather than being
    // dropped. Stated once, at registry level.
    expect(CLAIMS_REGISTRY.unregistered).toBe("passthrough");
    expect(CLAIMS_REGISTRY.specs).toBe(CLAIM_SPECS);
  });

  test("every entry is TOTAL over the wires", () => {
    // The compile-time guarantee is `wire: Record<Wire, WireKey>`; this is the
    // runtime half, so a `Wire` added to the union without a matching key in an
    // entry cannot slip through a cast.
    for (const spec of CLAIM_SPECS) {
      for (const wire of WIRE_TAGS) {
        expect(spec.wire[wire], `${spec.domain} has no ${wire} wire key`).toBeDefined();
      }
    }
  });

  test("no claim is absent on either wire — every claim rides both", () => {
    // The `absent` arm exists for the header registry (twelve JOSE parameters
    // have no COSE form). A claim that could not ride a wire has never existed
    // here, and `joseName`/`coseName` throw rather than return undefined, so
    // this pins the assumption they are built on.
    for (const spec of CLAIM_SPECS) {
      for (const wire of WIRE_TAGS) {
        expect(spec.wire[wire].kind, `${spec.domain} is absent on ${wire}`).not.toBe(
          "absent",
        );
      }
    }
  });

  test("every entry declares a non-empty direction and a required sample", () => {
    for (const spec of CLAIM_SPECS) {
      expect(
        spec.direction.length,
        `${spec.domain} has an empty direction`,
      ).toBeGreaterThan(0);
      expect(spec.sample, `${spec.domain} has no sample`).toBeDefined();
    }
  });

  test("every sample MATCHES its codec kind, not merely defined", () => {
    // Presence alone lets `sample: 2` sit on a `text` claim and pass. The
    // generated per-spec round-trip matrix consumes these samples, so a
    // wrong-shaped one yields a BOGUS round trip rather than a failure. The
    // expectation is derived from the codec kind through an exhaustive switch,
    // so a new ClaimCodec kind or BespokeKind is a COMPILE error here.
    for (const spec of CLAIM_SPECS) {
      // The BASE codec: `sample` is the DOMAIN-shaped value, and a per-wire
      // override (tokenId's cose `bstr`) describes the wire form, not the domain.
      expect(
        sampleMatchesCodec(spec.codec, spec.sample),
        `${spec.domain} sample does not match its ${describeCodec(spec.codec)} codec`,
      ).toBe(true);
    }
  });

  test("every entry declares a valid provenance, sensitivity and bucket", () => {
    const provenances = new Set(["caller", "key", "computed", "issuer"]);
    const sensitivities = new Set(["public", "sensitive"]);
    const buckets = new Set(["claims", "profile"]);

    for (const spec of CLAIM_SPECS) {
      expect(provenances.has(spec.provenance), `${spec.domain} bad provenance`).toBe(
        true,
      );
      expect(sensitivities.has(spec.sensitivity), `${spec.domain} bad sensitivity`).toBe(
        true,
      );
      expect(buckets.has(spec.bucket), `${spec.domain} bad bucket`).toBe(true);
    }
  });

  test("the computed/issuer provenance sets are exactly the claims aegis produces itself", () => {
    // Grounded in `assemble-common-claims.ts`: the mint clock (iat/nbf/exp), the
    // generated token id, and the three derived OIDC hashes are produced by
    // aegis; `iss` comes from the platform issuer identity. Everything else is
    // caller input.
    const withProvenance = (provenance: string) =>
      new Set(
        CLAIM_SPECS.filter((spec) => spec.provenance === provenance).map(
          (spec) => spec.domain,
        ),
      );

    expect(withProvenance("issuer")).toEqual(new Set(["issuer"]));
    expect(withProvenance("computed")).toEqual(
      new Set([
        "expiresAt",
        "notBefore",
        "issuedAt",
        "tokenId",
        "accessTokenHash",
        "codeHash",
        "stateHash",
      ]),
    );
    // No claim is derived from the signing key — that is a header-side provenance.
    expect(withProvenance("key")).toEqual(new Set());
  });

  // --- name selectors --------------------------------------------------------

  test("should give the two name selectors the same answer except where they diverge", () => {
    for (const spec of CLAIM_SPECS) {
      const differs = joseName(spec) !== coseName(spec);

      expect(differs, `${spec.domain}: selectors disagree unexpectedly`).toBe(
        spec.domain === "tokenId",
      );
    }
  });

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
    for (const spec of CLAIM_SPECS) {
      const acceptedNames = DOMAIN_CLAIM_KEYS[spec.domain];
      if (acceptedNames === undefined) continue; // SET-only claim, not extracted
      expect(
        acceptedNames.includes(joseName(spec)),
        `registry jose "${joseName(spec)}" not in extract-claims keys for "${spec.domain}"`,
      ).toBe(true);
    }
  });

  test("domain names are unique", () => {
    const domains = CLAIM_SPECS.map((s) => s.domain);
    expect(new Set(domains).size).toBe(domains.length);
  });

  test("jose names are unique", () => {
    const jose = CLAIM_SPECS.map(joseName);
    expect(new Set(jose).size).toBe(jose.length);
  });

  test("cose labels are unique where present", () => {
    const labels = CLAIM_SPECS.map(coseLabel).filter((c): c is number => c !== undefined);
    expect(new Set(labels).size).toBe(labels.length);
  });

  test("every lookup map resolves each entry back to itself", () => {
    for (const spec of CLAIM_SPECS) {
      expect(claimByDomain(spec.domain)).toBe(spec);
      expect(claimByJose(joseName(spec))).toBe(spec);
      expect(claimByCoseName(coseName(spec))).toBe(spec);

      const label = coseLabel(spec);
      if (label !== undefined) expect(claimByCose(label)).toBe(spec);
    }
  });

  // Standards-based assurance axes: a standard meaning but NO registered CWT
  // label, and short JOSE names (≤ 4 chars), so they are string-keyed.
  const STANDARDS_BASED_ASSURANCE = [
    "levelOfAssurance",
    "authenticatorAssuranceLevel",
    "identityAssuranceLevel",
    "federationAssuranceLevel",
  ];

  // The byte-size rule: a private-use label is 5 bytes; an N-char string key is
  // N + 1 bytes; so the integer is chosen only when it saves bytes (name ≥ 5).
  test("every private-use label (< -65536) has a JOSE name of length ≥ 5", () => {
    for (const spec of CLAIM_SPECS) {
      const label = coseLabel(spec);
      if (label === undefined || label >= -65536) continue;
      expect(
        joseName(spec).length,
        `${spec.domain} (${joseName(spec)}) is integer-keyed but ≤ 4 chars`,
      ).toBeGreaterThanOrEqual(5);
    }
  });

  test("every non-registered short claim (JOSE name ≤ 4 chars) is string-keyed", () => {
    for (const spec of CLAIM_SPECS) {
      const label = coseLabel(spec);
      // Registered standard CWT labels (1–9) are exempt from the byte-size rule.
      if (label !== undefined && label >= -65536) continue;
      if (joseName(spec).length > 4) continue;
      expect(
        spec.wire.cose.kind,
        `${spec.domain} (${joseName(spec)}) is ≤ 4 chars but not string-keyed`,
      ).toBe("name");
    }
  });

  test("registered labels (not private-use) are in the standard CWT range", () => {
    for (const spec of CLAIM_SPECS) {
      const label = coseLabel(spec);
      if (label === undefined || label < -65536) continue;
      expect(label).toBeGreaterThanOrEqual(-65536);
    }
  });

  test("standards-based assurance levels are string-keyed", () => {
    for (const domain of STANDARDS_BASED_ASSURANCE) {
      const spec = claimByDomain(domain);
      expect(spec?.wire.cose.kind, `${domain} must be string-keyed`).toBe("name");
    }
  });

  test("the standard CWT labels are correct (RFC 8392 / IANA)", () => {
    const labelOf = (domain: string) => {
      const spec = claimByDomain(domain);
      return spec ? coseLabel(spec) : undefined;
    };

    expect(labelOf("issuer")).toBe(1);
    expect(labelOf("subject")).toBe(2);
    expect(labelOf("audience")).toBe(3);
    expect(labelOf("expiresAt")).toBe(4);
    expect(labelOf("notBefore")).toBe(5);
    expect(labelOf("issuedAt")).toBe(6);
    expect(labelOf("tokenId")).toBe(7); // cti
    expect(labelOf("confirmation")).toBe(8);
    expect(labelOf("scope")).toBe(9);
  });

  test("OIDC nonce is NOT mapped to CWT label 10 (eat_nonce)", () => {
    // nonce has no registered CWT label; its name is ≥ 5 chars so it gets a
    // private-use label, but never the registered EAT label 10.
    const nonce = claimByDomain("nonce");
    expect(nonce && coseLabel(nonce)).not.toBe(10);
    expect(CLAIM_SPECS.some((spec) => coseLabel(spec) === 10)).toBe(false);
  });

  test("the COSE name diverges from the JOSE name exactly at RFC 8392 jti↔cti", () => {
    const divergences = CLAIM_SPECS.filter(
      (spec) => coseName(spec) !== joseName(spec),
    ).map((spec) => ({
      domain: spec.domain,
      jose: joseName(spec),
      cose: coseName(spec),
    }));

    expect(divergences).toEqual([{ domain: "tokenId", jose: "jti", cose: "cti" }]);
  });

  test("the sensitive claims match the AegisSensitive field set", () => {
    const sensitiveDomains = CLAIM_SPECS.filter(
      (spec) => spec.sensitivity === "sensitive",
    ).map((spec) => spec.domain);

    expect(new Set(sensitiveDomains)).toEqual(
      new Set(Object.keys(SENSITIVE_IDENTITY_FIELDS)),
    );
  });

  test('bucket "profile" claims match the AegisProfile field set', () => {
    const profileDomains = CLAIM_SPECS.filter((spec) => spec.bucket === "profile").map(
      (spec) => spec.domain,
    );

    expect(new Set(profileDomains)).toEqual(new Set(Object.keys(PROFILE_FIELDS)));
  });

  test("sensitivity and bucket are INDEPENDENT columns", () => {
    // The three-way `category` this replaced could only say one of the two, so
    // the sensitive claims had to give up their bucket to declare their
    // sensitivity. Pin that they now say both: every sensitive claim is in the
    // `claims` bucket, and no profile claim is sensitive.
    for (const spec of CLAIM_SPECS) {
      if (spec.sensitivity !== "sensitive") continue;
      expect(spec.bucket, `${spec.domain} sensitive but not in the claims bucket`).toBe(
        "claims",
      );
    }
    expect(
      CLAIM_SPECS.filter(
        (spec) => spec.bucket === "profile" && spec.sensitivity === "sensitive",
      ),
    ).toEqual([]);
  });

  // --- codec ----------------------------------------------------------------

  test("the array scalar-tolerance policies are populated exactly", () => {
    const withScalar = (scalar: string) =>
      new Set(
        CLAIM_SPECS.filter(
          (spec) => spec.codec.kind === "array" && spec.codec.scalar === scalar,
        ).map((spec) => spec.domain),
      );

    expect(withScalar("spaced")).toEqual(
      new Set(["scope", "roles", "permissions", "conformsTo"]),
    );
    expect(withScalar("strict")).toEqual(
      new Set([
        "authMethods",
        "authFactorCategories",
        "entitlements",
        "groups",
        "preferredAccessibility",
      ]),
    );
    // RFC 7519 aud is string-OR-array and is the only wrapping claim. This used
    // to be a hardcoded `spec.domain === "audience"` branch in the translator.
    expect(withScalar("wrap")).toEqual(new Set(["audience"]));
  });

  test("the temporal claim set + directions are populated exactly", () => {
    const temporal = CLAIM_SPECS.filter((s) => s.temporal !== undefined).map((s) => ({
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

  test('a temporal mark implies a "date" codec; updatedAt is a date but NOT temporal', () => {
    for (const spec of CLAIM_SPECS) {
      if (spec.temporal === undefined) continue;
      expect(spec.codec.kind, `${spec.domain} is temporal but not a date`).toBe("date");
    }
    expect(claimByDomain("updatedAt")?.codec.kind).toBe("date");
    expect(claimByDomain("updatedAt")?.temporal).toBeUndefined();
  });

  test("username and preferredUsername are separate entries in separate buckets", () => {
    // RFC 7662 §2.2 `username` is a claim ABOUT the token; OIDC Core §5.1
    // `preferred_username` is a PROFILE field. Same-looking names, different
    // specs, different read-side buckets — collapsing one into the other is the
    // failure this pins.
    const username = claimByDomain("username");
    const preferred = claimByDomain("preferredUsername");

    expect(username && joseName(username)).toBe("username");
    expect(username?.bucket).toBe("claims");
    expect(username?.subset).toBe("core");

    expect(preferred && joseName(preferred)).toBe("preferred_username");
    expect(preferred?.bucket).toBe("profile");
    expect(preferred?.subset).toBeUndefined();

    expect(claimByJose("username")?.domain).toBe("username");
    expect(claimByJose("preferred_username")?.domain).toBe("preferredUsername");
  });

  test("lookups resolve by domain and jose", () => {
    const issuer = claimByDomain("issuer");
    expect(issuer && joseName(issuer)).toBe("iss");
    expect(claimByJose("iss")?.domain).toBe("issuer");
  });

  test("every COSE label is a registered integer or a private-use label", () => {
    // The IANA CWT allocation policy: registered labels are positive; the
    // lindorm private-use labels are < -65536. The reserved specification-required
    // band in between is never squatted. (A name-keyed claim has no label.)
    for (const spec of CLAIM_SPECS) {
      const label = coseLabel(spec);
      if (label === undefined) continue;
      expect(label > 0 || label < -65536).toBe(true);
    }
  });

  // --- per-wire codec -------------------------------------------------------

  test("tokenId is the ONE claim with a per-wire codec (text on JOSE, bstr on COSE)", () => {
    const perWire = CLAIM_SPECS.filter((spec) => spec.codec.per !== undefined).map(
      (spec) => spec.domain,
    );

    expect(perWire).toEqual(["tokenId"]);

    const tokenId = claimByDomain("tokenId")!;
    expect(codecFor(tokenId, "jose").kind).toBe("text");
    expect(codecFor(tokenId, "cose").kind).toBe("bstr");
  });

  test("codecFor falls back to the base codec where no override exists", () => {
    for (const spec of CLAIM_SPECS) {
      if (spec.codec.per !== undefined) continue;
      for (const wire of WIRE_TAGS) {
        expect(codecFor(spec, wire)).toBe(spec.codec);
      }
    }
  });

  test('no claim carries "bstr" as its BASE codec', () => {
    // JOSE has no byte strings, and the base codec is what the translator reads
    // for BOTH wires. A `bstr` base would silently be treated as text on JOSE —
    // which is exactly what `jti` used to do.
    for (const spec of CLAIM_SPECS) {
      expect(spec.codec.kind, `${spec.domain} has a bstr base codec`).not.toBe("bstr");
    }
  });

  // --- Bespoke sub-kind drift guards ---------------------------------------

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
      CLAIM_SPECS.filter((spec) => spec.codec.kind === "bespoke").map((spec) => [
        spec.domain,
        spec.codec.kind === "bespoke" ? spec.codec.bespoke : undefined,
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

    const withBespoke = (bespoke: string) =>
      new Set(
        CLAIM_SPECS.filter(
          (spec) => spec.codec.kind === "bespoke" && spec.codec.bespoke === bespoke,
        ).map((spec) => spec.domain),
      );

    expect(withBespoke("hash")).toEqual(new Set(FROZEN_HASH_DOMAINS));
    expect(withBespoke("act")).toEqual(new Set(FROZEN_ACT_DOMAINS));
  });

  // --- Subset-membership drift guards --------------------------------------

  test("the three extraction subsets derive to their frozen membership", () => {
    // Freeze the previously-hardcoded FIELD_KEYS / RFC8693_KEYS / POP_KEYS from
    // extract-claims.ts. DOMAIN_CLAIM_KEYS is DERIVED from the registry's
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
      username: ["username"],
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
        CLAIM_SPECS.filter((spec) => spec.subset === subset).map((spec) => spec.domain),
      );
    expect(domainsWithSubset("core")).toEqual(new Set(Object.keys(FROZEN_FIELD_KEYS)));
    expect(domainsWithSubset("rfc8693")).toEqual(
      new Set(Object.keys(FROZEN_RFC8693_KEYS)),
    );
    expect(domainsWithSubset("pop")).toEqual(new Set(Object.keys(FROZEN_POP_KEYS)));
  });
});
