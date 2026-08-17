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
import type { AegisProfile, AegisSensitive, DomainClaims } from "../../types/index.js";
import type { BespokeKind, ClaimCodec, ClaimSpec } from "../registry/claim-spec.js";
import { codecFor } from "../registry/param-spec.js";
import { WIRE_TAGS } from "../registry/wire.js";
import {
  CLAIM_SPECS,
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

// The frozen `[domain, jose]` pairs the verify-FLOOR read resolves — the claims
// carrying a `domainClaim` mark. These literals are the INDEPENDENT side of the
// guard: not derived from the registry, so a registry edit that changes a name
// or drops a mark fails the test below instead of silently redefining what the
// floor can see.
//
// ⚠ Two further bindings stop this being a table asserted against itself: the
// keys are bound to the `DomainClaims` TYPE by `satisfies` (a renamed claim is a
// compile error), and `UnmarkedDomainClaim` below binds the REVERSE direction.
const FROZEN_DOMAIN_CLAIM_KEYS = {
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
  // RFC 8693 delegation and RFC 7800 proof-of-possession: recursive shapes, but
  // the floor resolves them by exactly the same rule as every flat claim above.
  act: ["act"],
  mayAct: ["mayAct", "may_act"],
  confirmation: ["confirmation", "cnf"],
} satisfies Partial<Record<keyof DomainClaims, ReadonlyArray<string>>>;

type FrozenDomainClaim = keyof typeof FROZEN_DOMAIN_CLAIM_KEYS;

/**
 * The REVERSE binding, enforced by the compiler: add a claim to `DomainClaims`
 * without freezing it above and `UnmarkedDomainClaim` stops being `never`, so
 * this assignment no longer accepts `true` and the build fails. Without it the
 * frozen table could only ever catch claims it already knows about — which is
 * how a table ends up asserting itself.
 */
type UnmarkedDomainClaim = Exclude<keyof DomainClaims, FrozenDomainClaim>;
const EVERY_DOMAIN_CLAIM_IS_FROZEN: UnmarkedDomainClaim extends never
  ? true
  : UnmarkedDomainClaim = true;

describe("CLAIM_REGISTRY", () => {
  // --- shared ParamSpec base ------------------------------------------------

  // ⚠ A test stood here asserting `CLAIMS_REGISTRY.unregistered === "passthrough"`
  // and `CLAIMS_REGISTRY.specs === CLAIM_SPECS` — the literal against itself, and
  // nothing else. The wrapper is deleted with it. What the column CLAIMED is
  // exercised where it actually happens: `translate.test.ts` requires an
  // unregistered claim to reach `custom` with its value untouched, on both the
  // domain read and the floor read.

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

  test("every entry declares a required sample", () => {
    for (const spec of CLAIM_SPECS) {
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
      // override (the token id and the three OIDC hashes, each `bstr` on COSE)
      // describes the wire form, not the domain.
      expect(
        sampleMatchesCodec(spec.codec, spec.sample),
        `${spec.domain} sample does not match its ${describeCodec(spec.codec)} codec`,
      ).toBe(true);
    }
  });

  test("every entry declares a valid sensitivity and bucket", () => {
    const sensitivities = new Set(["public", "sensitive"]);
    const buckets = new Set(["claims", "profile"]);

    for (const spec of CLAIM_SPECS) {
      expect(sensitivities.has(spec.sensitivity), `${spec.domain} bad sensitivity`).toBe(
        true,
      );
      expect(buckets.has(spec.bucket), `${spec.domain} bad bucket`).toBe(true);
    }
  });

  // ⚠ A `provenance` column stood here and TWO tests bound it to hand-written
  // expected sets — mirroring, not deriving. Both are deleted with the column.
  // Nothing is lost: the question the column claimed to answer is "is there a
  // caller door, and which one?", and `__fixtures__/spec-dispositions.ts` answers
  // it by NAMING the door and `Aegis.spec-matrix.test.ts` by RUNNING it. That
  // artifact refused to derive from the column in its own words, which is the
  // sharpest evidence the column answered a question no consumer asks.

  // --- name selectors --------------------------------------------------------

  test("should give the two name selectors the same answer except where they diverge", () => {
    for (const spec of CLAIM_SPECS) {
      const differs = joseName(spec) !== coseName(spec);

      expect(differs, `${spec.domain}: selectors disagree unexpectedly`).toBe(
        spec.domain === "tokenId",
      );
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

  /**
   * The `whenEmpty: "keep"` set, frozen by name. The column has no default, so a
   * new claim cannot dodge the decision — but an EXISTING one can be flipped in a
   * one-word diff, and a flip either fabricates an assertion the issuer never made
   * or strips a restriction the issuer did make. Both are silent on the wire, so
   * the set is pinned here and a change to it has to be a change to this list.
   */
  test("the claims kept when empty are exactly the stated set", () => {
    const keep = CLAIM_SPECS.filter((s) => s.whenEmpty === "keep").map((s) => s.domain);

    // Registry declaration order. Restrictions (`aud`, RAR), bindings (`cnf`, the
    // OIDC hashes), delegation (`act`/`may_act`), and the two RFC 8417/9493 claims
    // a SET IS.
    //
    // ⚠ The four lindorm authority lists — `roles`, `permissions`, `entitlements`,
    // `groups` — are deliberately NOT here. They prune: they are our own
    // vocabulary, no specification gives their absence a default-resolving
    // reading, and the only issuer that mints them states that an empty list "is
    // emitted as absence"
    // (`services/tyr/src/features/tokens/utils/mint-access-token.ts:10-17`).
    // `scope` IS here, and splits from them as AEGIS POLICY — see its registry
    // entry. ⚠ Not because a specification defines its absence: RFC 6749 §3.3 is
    // about the AUTHORIZATION SERVER defaulting a CLIENT REQUEST that omits
    // `scope`, not about reading an absent CLAIM, and an earlier version of this
    // comment cited it wrongly. The real reason is that RFC 9068 §2.2.3 makes
    // `scope` only a SHOULD, so absence is indistinguishable from a grant that
    // never had one — which is what leaves an explicit empty list something to say.
    expect(keep).toEqual([
      "audience",
      "confirmation",
      "scope",
      "act",
      "accessTokenHash",
      "codeHash",
      "stateHash",
      "authorizationDetails",
      "mayAct",
      "subjectId",
      "events",
    ]);
  });

  /**
   * NO CLAIM MAY `refuse`, and the COMPILER is what says so — `ClaimSpec`
   * instantiates the shared base at `"keep" | "prune"` while `HeaderSpec` takes
   * the whole {@link WhenEmpty} vocabulary.
   *
   * ⚠ This replaced a runtime loop asserting every cell was one of the two, and
   * that loop COULD NOT GO RED: the column is required and non-optional over a
   * closed union, so a missing or off-vocabulary cell was already a compile
   * error — the loop only restated what the compiler refuses, which is exactly
   * the reasoning `header-registry.test.ts` gives for pinning a COUNT instead of
   * looping a column.
   *
   * ⚠⚠ THIS IS A TYPECHECK ASSERTION, AND IT IS INERT UNDER `npm test`. An
   * UNUSED `@ts-expect-error` is itself a compile error, so DELETING the
   * narrowing on `ClaimSpec` raises `TS2578` and reddens `npm run typecheck` /
   * `npm run build` / `npm run verify` — exit 2. Under vitest the body is
   * `expect(spec.whenEmpty).toBe("refuse")` on a value assigned one line above:
   * a tautology that passes whatever `ClaimSpec` says, and its only job is to
   * stop the binding being unused. **A green `npm test` says NOTHING about this
   * invariant** — verified red-before-green on the typecheck, not on vitest.
   *
   * The reason no claim needs it: a claim reaches the emission boundary having
   * already passed a layer that speaks about it in its own vocabulary — the
   * profile floor, which refuses an empty value through `isClaimSatisfied`
   * (`internal/utils/rules/`) and throws with the claim's DOMAIN name. A header
   * parameter aegis writes at assembly time has no such layer above it. ⚠ The
   * floor covers only the claims a PROFILE names, so the coverage is a profile
   * decision, not a registry one — `claim-spec.ts` carries the full reasoning.
   */
  test("no claim can state the header-only refuse verdict", () => {
    const spec: ClaimSpec = {
      ...CLAIM_SPECS[0]!,
      // @ts-expect-error - "refuse" is a HEADER verdict; ClaimSpec narrows it away
      whenEmpty: "refuse",
    };

    // The cast landed the value all the same — the guard is the DIRECTIVE above,
    // not this assertion, which only stops the binding being unused.
    expect(spec.whenEmpty).toBe("refuse");
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
    expect(username?.domainClaim).toBe(true);

    expect(preferred && joseName(preferred)).toBe("preferred_username");
    expect(preferred?.bucket).toBe("profile");
    expect(preferred?.domainClaim).toBeUndefined();

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

  test("the per-wire codec claims are frozen, in registry order (text on JOSE, bstr on COSE)", () => {
    // EXACT and ORDERED, deliberately: a FIFTH per-wire codec has to be a
    // decision someone took here, not something a registry edit slipped in.
    // `toContain` would let one through.
    const perWire = CLAIM_SPECS.filter((spec) => spec.codec.per !== undefined).map(
      (spec) => spec.domain,
    );

    expect(perWire).toEqual(["tokenId", "accessTokenHash", "codeHash", "stateHash"]);

    for (const domain of perWire) {
      const spec = claimByDomain(domain)!;
      expect(codecFor(spec, "jose").kind, `${domain} on JOSE`).toBe("text");
      expect(codecFor(spec, "cose").kind, `${domain} on COSE`).toBe("bstr");
    }
  });

  test("the COSE byte ENCODING each per-wire claim declares is frozen", () => {
    // ⚠ THE GUARD THE COLLAPSE OF `bespoke: "hash"` MADE NECESSARY. `"utf8"` and
    // `"b64u"` are indistinguishable at the type level and produce DIFFERENT
    // bytes on a signed wire: `cti` is the token id's own UTF-8, an OIDC hash is
    // the 32 bytes its 43-char b64url string decodes to. Nothing else in the
    // package would notice one flipping — `c_hash`/`s_hash` had no byte-shape
    // assertion anywhere before this step, and the knob probes assert key
    // PRESENCE only.
    //
    // DERIVED from `CLAIM_SPECS` on both sides: the SETS are computed, only the
    // membership is frozen. A new per-wire claim lands in one of these two
    // buckets and fails here until someone states which.
    const byEncoding = (encoding: string): Array<string> =>
      CLAIM_SPECS.filter((spec) => {
        const cose = codecFor(spec, "cose");
        return cose.kind === "bstr" && cose.encoding === encoding;
      }).map((spec) => spec.domain);

    expect(byEncoding("utf8")).toEqual(["tokenId"]);
    expect(byEncoding("b64u")).toEqual(["accessTokenHash", "codeHash", "stateHash"]);

    // And the two buckets ACCOUNT FOR EVERY `bstr` claim — otherwise a third
    // encoding could be added and both assertions above would still pass.
    const everyBstr = CLAIM_SPECS.filter(
      (spec) => codecFor(spec, "cose").kind === "bstr",
    ).map((spec) => spec.domain);

    expect([...everyBstr].sort()).toEqual(
      [...byEncoding("utf8"), ...byEncoding("b64u")].sort(),
    );
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
    // sub-kind (act+mayAct -> "act"). A future registry edit that re-routes a
    // claim to a different builder fails here.
    //
    // ⚠ The three OIDC hashes USED to be here under a `"hash"` sub-kind, and
    // dropping out of this record is exactly why the byte-encoding guard below
    // exists: a claim that stops being `bespoke` stops being pinned as a group
    // by this test, so the group it moved INTO has to be pinned too.
    const FROZEN_BESPOKE: Record<string, string> = {
      confirmation: "confirmation",
      act: "act",
      mayAct: "act",
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

  // --- DomainClaims-membership drift guards --------------------------------

  test("the domain-claim mark derives to its frozen membership", () => {
    // The frozen table lives at module scope so the compile-time reverse binding
    // (`UnmarkedDomainClaim`) can reach it; see the comment there.
    expect(EVERY_DOMAIN_CLAIM_IS_FROZEN).toBe(true);

    const FROZEN_KEYS: Record<string, ReadonlyArray<string>> = FROZEN_DOMAIN_CLAIM_KEYS;

    // Every marked spec resolves under exactly the frozen accepted names: its
    // domain name, plus its jose name when the two differ. That pair is what the
    // floor read looks up, in that precedence.
    for (const spec of CLAIM_SPECS) {
      if (spec.domainClaim === undefined) continue;
      const jose = joseName(spec);
      const accepted = spec.domain === jose ? [spec.domain] : [spec.domain, jose];

      expect(FROZEN_KEYS[spec.domain], `unfrozen domain claim "${spec.domain}"`).toEqual(
        accepted,
      );
    }

    // …and nothing frozen has lost its registry entry or its mark.
    for (const domain of Object.keys(FROZEN_KEYS)) {
      expect(
        claimByDomain(domain)?.domainClaim,
        `"${domain}" lost its domainClaim mark`,
      ).toBeDefined();
    }

    // Both directions over the same fact: the marked set is EXACTLY the frozen
    // set, so a mark added to a claim nobody froze fails here too.
    const marked = new Set(
      CLAIM_SPECS.filter((spec) => spec.domainClaim !== undefined).map(
        (spec) => spec.domain,
      ),
    );
    expect(marked).toEqual(new Set(Object.keys(FROZEN_KEYS)));
  });
});
