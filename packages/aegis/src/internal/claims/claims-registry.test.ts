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
import type {
  ActClaimMembers,
  AegisProfile,
  AegisProfileAddress,
  AegisSensitive,
  DomainClaims,
} from "../../types/index.js";
import type {
  BespokeKind,
  ClaimCodec,
  ClaimMemberSpec,
  ClaimSpec,
  ObjectCodec,
} from "../registry/claim-spec.js";
import { codecFor } from "../registry/param-spec.js";
import type { SubjectIdentifierMembers } from "./sub-id.js";
import { type Wire, WIRE_TAGS } from "../registry/wire.js";
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
 *
 * ⚠ THE DESCENT IS CYCLE-GUARDED, and the guard is keyed on the `children`
 * THUNK. RFC 8693 §4.1 defines the actor chain recursively — an `act` contains
 * an `act` — so a member set can and will reference itself, and this walk would
 * not terminate: measured, a self-referential declaration takes it to
 * `RangeError: Maximum call stack size exceeded`. The thunk is the stable
 * identity to key on; the arrays it returns are fresh on every call and would
 * defeat a set keyed on them. Same guard, same reasoning, as
 * `internal/cose/cwt-spec.ts`'s `shapeForObject`.
 */
const sampleMatchesCodec = (
  codec: ClaimCodec,
  sample: unknown,
  seen: Set<() => ReadonlyArray<ClaimMemberSpec>> = new Set(),
): boolean => {
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
      // An array of STRINGS samples strings; an array of DECLARED STRUCTURES
      // samples the structure, at least once — a zero-element sample would
      // satisfy `every` without ever reaching a member.
      return codec.of === undefined
        ? isArray(sample) && sample.every(isString)
        : isArray(sample) &&
            sample.length > 0 &&
            sample.every((element) => sampleMatchesCodec(codec.of, element, seen));
    case "object":
      // A declared structure is checked THROUGH its members: the claim's sample
      // must be an object, and every member's own sample must satisfy that
      // member's own codec. That is what binds a member `sample` to something
      // rather than letting it sit unchecked one level below the claim.
      if (!isObject(sample)) return false;
      if (seen.has(codec.children)) return true;

      seen.add(codec.children);

      return codec
        .children()
        .every((member) => sampleMatchesCodec(member.codec, member.sample, seen));
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
    case "events":
      return isObject(sample);
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
    // ⚠ THE TWO ARRAY FORMS ARE COUNTED APART. An array of STRINGS answers a
    // scalar-tolerance question; an array of declared STRUCTURES has none to
    // answer and carries no `scalar` cell at all. A single set over
    // `kind === "array"` would let a claim move between the two forms without
    // this guard noticing, which is the one move that changes what the
    // translator does with it.
    const withScalar = (scalar: string) =>
      new Set(
        CLAIM_SPECS.filter(
          (spec) =>
            spec.codec.kind === "array" &&
            spec.codec.of === undefined &&
            spec.codec.scalar === scalar,
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

    // RFC 9396 authorization_details is the only collection of structures.
    const structures = CLAIM_SPECS.filter(
      (spec) => spec.codec.kind === "array" && spec.codec.of !== undefined,
    ).map((spec) => spec.domain);

    expect(structures).toEqual(["authorizationDetails"]);
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
    // sub-kind. A future registry edit that re-routes a claim to a different
    // builder fails here.
    //
    // ⚠ The three OIDC hashes USED to be here under a `"hash"` sub-kind,
    // `address` under an `"address"` one, `authorizationDetails` under an
    // `"authDetails"` one, `act`+`mayAct` under a shared `"act"` one, and
    // `subjectId` under a `"subId"` one, and
    // dropping out of this record is exactly why the byte-encoding guard below
    // and the structure guard after it exist: a claim that stops being `bespoke`
    // stops being pinned as a group by this test, so the group it moved INTO has
    // to be pinned too.
    const FROZEN_BESPOKE: Record<string, string> = {
      confirmation: "confirmation",
      events: "events",
    };

    const actual = Object.fromEntries(
      CLAIM_SPECS.filter((spec) => spec.codec.kind === "bespoke").map((spec) => [
        spec.domain,
        spec.codec.kind === "bespoke" ? spec.codec.bespoke : undefined,
      ]),
    );

    expect(actual).toEqual(FROZEN_BESPOKE);
  });

  test("every declared member is frozen in EVERY cell it carries", () => {
    // The group `address` and `authorizationDetails` moved INTO when they stopped
    // being bespoke, pinned the same way and for the same reason: a claim that
    // leaves one drift guard has to arrive in another, or the migration removed
    // coverage.
    //
    // ⚠⚠ IT FREEZES THE WHOLE MEMBER, NOT ITS SPELLING. This table pinned
    // `domain -> per-wire name` alone, and that left four of the five columns a
    // declaration carries unwatched. Measured: flipping `country.whenEmpty` from
    // `keep` to `prune` left the ENTIRE SUITE GREEN — a signed token silently
    // dropping a member its issuer wrote. Only `postalCode` was covered, by the
    // single wire pin that happens to mint an empty member
    // (`classes/address-claim-wire.test.ts`), and one behavioural pin cannot
    // stand in for seven declarations. A `whenEmpty`, a `required` or a `codec`
    // that can change with nothing going red is a cell nothing defends.
    //
    // ⚠ BOTH DECLARED FORMS ARE COLLECTED. A claim declaring an ARRAY of
    // structures declares its member set on the element, so a collector that
    // read `kind === "object"` alone would silently stop covering the claim the
    // moment it migrated.
    //
    // ⭐ DERIVED ON ONE SIDE, HAND-WRITTEN ON THE OTHER. The registry supplies
    // the actual values; the expectation below is written out. Building the
    // expectation FROM the registry would assert the table against itself — the
    // trap this package has already re-committed twice inside artifacts built to
    // cure it.
    //
    // ⭐ A NEW STRUCTURE MUST EXTEND THIS TABLE. The comparison is whole-object
    // equality over every claim that declares children, so `act`, `subjectId`
    // and `events` cannot arrive with a member that states no frozen cell.
    //
    // ⭐⭐ AND THE `address` HALF IS BOUND TO THE PUBLIC TYPE, which is what stops
    // this one table from being a single point of failure. Deleting a member's
    // DECLARATION is invisible on the wire — `open: "flip"` plus
    // `snakeCase("careOf") === "care_of"` means the bytes are identical whether a
    // member is declared or carried by the open tail, so the corpus, every round
    // trip and every conformance scenario stay green — and the runtime row below
    // is therefore the only thing that reddens. That would leave one obvious
    // repair: delete the row too. `Record<keyof AegisProfileAddress, …>` closes
    // it — the row cannot go while the PUBLIC type still declares the member, so
    // the two edits that would together hide the deletion cannot both be made.
    // ⚠ Only `address` can be bound this way. The RFC 9396 element's public type
    // (`AuthorizationDetail`) is deliberately OPEN (`& Dict`; RFC 9396 §2 makes
    // the `type` determine the rest), so `keyof` it is `string` and binds
    // nothing — which is a fact about that claim, not a gap here.
    type FrozenMember = {
      jose: string;
      cose: string;
      whenEmpty: "keep" | "prune";
      required: boolean;
      codec: ClaimCodec["kind"];
    };

    /**
     * TOTAL over the PUBLIC address type — see the note above. A member the type
     * declares and the registry does not is a compile error here.
     */
    const FROZEN_ADDRESS: Record<keyof AegisProfileAddress, FrozenMember> = {
      // OIDC Core §5.1.1's own six. All `keep`: §5.1.1 states no mandatory
      // member, and the blanket case flip this replaced carried an empty member
      // onto the wire, so `keep` is what reproduces it.
      formatted: {
        jose: "formatted",
        cose: "formatted",
        whenEmpty: "keep",
        required: false,
        codec: "text",
      },
      streetAddress: {
        jose: "street_address",
        cose: "street_address",
        whenEmpty: "keep",
        required: false,
        codec: "text",
      },
      locality: {
        jose: "locality",
        cose: "locality",
        whenEmpty: "keep",
        required: false,
        codec: "text",
      },
      region: {
        jose: "region",
        cose: "region",
        whenEmpty: "keep",
        required: false,
        codec: "text",
      },
      postalCode: {
        jose: "postal_code",
        cose: "postal_code",
        whenEmpty: "keep",
        required: false,
        codec: "text",
      },
      country: {
        jose: "country",
        cose: "country",
        whenEmpty: "keep",
        required: false,
        codec: "text",
      },
      // The lindorm extension. It is NOT an OIDC Core §5.1.1 member, and it
      // appears here beside the six so a reader can see which is which.
      careOf: {
        jose: "care_of",
        cose: "care_of",
        whenEmpty: "keep",
        required: false,
        codec: "text",
      },
    };

    /**
     * TOTAL over `ActClaimMembers`, for the same reason `FROZEN_ADDRESS` is total
     * over `AegisProfileAddress`: a member the type declares and the registry does
     * not is a compile error here, so the row and the declaration cannot be
     * deleted together.
     *
     * ⚠⚠ IT IS `ActClaimMembers` AND NOT `ActClaim`, AND THE SPLIT EXISTS FOR THIS
     * BINDING. `ActClaim` is `ActClaimMembers & Dict` — the RFC 8693 member set is
     * OPEN — and `keyof (X & Dict)` widens to `string`, which would have made this
     * `Record` accept anything and evaporated the guard silently. That is not
     * hypothetical: it is precisely what has already happened to
     * `AuthorizationDetail`, whose own note below says the binding buys nothing
     * there. Splitting the DECLARED members into their own type keeps the closed
     * half closed while the claim itself is open.
     *
     * ⚠ THE COSE COLUMN IS THE STRING FALLBACK, NOT THE LABEL. Every actor member
     * is keyed by an INTEGER on COSE (`iss` 1, `sub` 2, `aud` 3 from RFC 8392 §4;
     * `client_id` 4 and the nested `act` 5 are lindorm's own), and `coseName`
     * reports the interoperable string a token degrades to. The labels themselves
     * are pinned on the WIRE, by `classes/act-claim-wire.test.ts`, which is where
     * a wrong one is a wrong token rather than a wrong table.
     */
    const FROZEN_ACT: Record<keyof ActClaimMembers, FrozenMember> = {
      issuer: {
        jose: "iss",
        cose: "iss",
        whenEmpty: "keep",
        required: false,
        codec: "text",
      },
      subject: {
        jose: "sub",
        cose: "sub",
        whenEmpty: "keep",
        required: false,
        codec: "text",
      },
      // RFC 7519 §4.1.3 makes `aud` string-OR-array, so the member is an array
      // with the `wrap` tolerance rather than a text scalar.
      audience: {
        jose: "aud",
        cose: "aud",
        whenEmpty: "keep",
        required: false,
        codec: "array",
      },
      clientId: {
        jose: "client_id",
        cose: "client_id",
        whenEmpty: "keep",
        required: false,
        codec: "text",
      },
      // ⭐ THE SELF-REFERENCE. Its codec is `object`, and the member set that
      // codec names is the one this table describes.
      act: {
        jose: "act",
        cose: "act",
        whenEmpty: "keep",
        required: false,
        codec: "object",
      },
    };

    /**
     * TOTAL over `SubjectIdentifierMembers`, the same binding `FROZEN_ACT` has to
     * `ActClaimMembers`: a member the public type declares and the registry does
     * not is a compile error here, so a declaration and its row cannot be deleted
     * together.
     *
     * ⚠ THE COSE COLUMN IS THE STRING FALLBACK, NOT THE LABEL. Every Subject
     * Identifier member is keyed by an INTEGER on COSE (`iss` 1 and `sub` 2 from
     * RFC 8392 §4; `format` 0 and 4-9 are lindorm's own, with 3 left unallocated
     * because RFC 8392 gives it to `aud`). The labels are pinned on the WIRE, by
     * `classes/sub-id-claim-wire.test.ts`, where a wrong one is a wrong token.
     *
     * ⭐ `phoneNumber` IS THE CELL THIS STEP MOVED. It was `phone_number` in the
     * DOMAIN bag — the only structured claim that made a caller write snake_case —
     * and the jose/cose columns show where the wire spelling now lives instead.
     */
    const FROZEN_SUB_ID: Record<keyof SubjectIdentifierMembers, FrozenMember> = {
      // RFC 9493 §3: "A Subject Identifier ... MUST contain a 'format' member
      // whose value is the name of that Identifier Format." Unconditional, so it
      // is `required` rather than a row in the per-format table. ⚠ `whenEmpty` is
      // INERT while `required` holds, exactly as `authorizationDetails.type`'s is.
      format: {
        jose: "format",
        cose: "format",
        whenEmpty: "prune",
        required: true,
        codec: "text",
      },
      iss: {
        jose: "iss",
        cose: "iss",
        whenEmpty: "keep",
        required: false,
        codec: "text",
      },
      sub: {
        jose: "sub",
        cose: "sub",
        whenEmpty: "keep",
        required: false,
        codec: "text",
      },
      email: {
        jose: "email",
        cose: "email",
        whenEmpty: "keep",
        required: false,
        codec: "text",
      },
      phoneNumber: {
        jose: "phone_number",
        cose: "phone_number",
        whenEmpty: "keep",
        required: false,
        codec: "text",
      },
      uri: {
        jose: "uri",
        cose: "uri",
        whenEmpty: "keep",
        required: false,
        codec: "text",
      },
      url: {
        jose: "url",
        cose: "url",
        whenEmpty: "keep",
        required: false,
        codec: "text",
      },
      id: { jose: "id", cose: "id", whenEmpty: "keep", required: false, codec: "text" },
      // ⭐ THE ARRAY OF SELF. Its codec is `array` — not `object`, which is what
      // `act`'s self-reference carries — and the member set that array's element
      // names is the one this table describes. RFC 9493 §3.2.8.
      identifiers: {
        jose: "identifiers",
        cose: "identifiers",
        whenEmpty: "keep",
        required: false,
        codec: "array",
      },
    };

    const FROZEN_MEMBERS: Record<string, Record<string, FrozenMember>> = {
      // ⚠ ONE MEMBER SET, TWO CLAIMS, and the table states it twice on purpose:
      // the equality below is per CLAIM, so declaring the shared array is what
      // makes "these two claims have the same members" checkable rather than
      // assumed.
      act: FROZEN_ACT,
      mayAct: FROZEN_ACT,
      authorizationDetails: {
        // RFC 9396 §2's one mandatory field, and the only one it names as
        // belonging to the specification rather than to whoever registers the
        // `type`. ⚠ `whenEmpty` is INERT while `required` holds — both refuse an
        // empty value — but it is frozen anyway, because the day `required` is
        // dropped the cell goes live and this table is what notices.
        type: {
          jose: "type",
          cose: "type",
          whenEmpty: "prune",
          required: true,
          codec: "text",
        },
      },
      subjectId: FROZEN_SUB_ID,
      address: FROZEN_ADDRESS,
    };

    const childrenOf = (
      codec: ClaimCodec,
    ): (() => ReadonlyArray<ClaimMemberSpec>) | undefined =>
      codec.kind === "object"
        ? codec.children
        : codec.kind === "array"
          ? codec.of?.children
          : undefined;

    const actual = Object.fromEntries(
      CLAIM_SPECS.map((spec) => [spec.domain, childrenOf(spec.codec)] as const)
        .filter(
          (entry): entry is readonly [string, () => ReadonlyArray<ClaimMemberSpec>] =>
            entry[1] !== undefined,
        )
        .map(([domain, children]) => [
          domain,
          Object.fromEntries(
            children().map((member) => [
              member.domain,
              {
                jose: joseName(member),
                cose: coseName(member),
                whenEmpty: member.whenEmpty,
                // Normalised to a boolean so EVERY member states the cell.
                // `required?: true` makes the absent case `undefined`, and a
                // table where six rows omit a column is a table six members are
                // not pinned by.
                required: member.required === true,
                codec: member.codec.kind,
              },
            ]),
          ),
        ]),
    );

    expect(actual).toEqual(FROZEN_MEMBERS);
  });

  test("the MANDATORY members are exactly the ones a specification mandates", () => {
    // `required` is the one member column that causes a REFUSAL rather than a
    // transformation, in both directions and under every profile — so a cell
    // added or dropped changes which tokens this package will issue and accept.
    // Frozen as `claim.member` paths, derived from the registry on the other
    // side, so neither a new required member nor a lost one can arrive quietly.
    //
    // ⚠⚠ IT DESCENDS, AND IT DID NOT UNTIL A NESTED `required` EXISTED. The walk
    // read each claim's DIRECT children alone, so a mandatory member one level
    // down was frozen nowhere — the same shallow-walk hole the tail-policy guard
    // below was already fixed for. RFC 9493 §3.2.8 makes every element of
    // `sub_id.identifiers` a Subject Identifier, so `format` is mandatory INSIDE
    // an alias too, and a walk stopping at depth 1 would let that cell be dropped
    // with nothing red. Path-keyed and cycle-guarded on the `children` thunk, so
    // the self-referential sets terminate.
    const required: Array<string> = [];
    const seen = new Set<() => ReadonlyArray<ClaimMemberSpec>>();

    const visit = (codec: ClaimCodec, path: string): void => {
      const children =
        codec.kind === "object"
          ? codec.children
          : codec.kind === "array"
            ? codec.of?.children
            : undefined;

      if (children === undefined) return;
      if (seen.has(children)) return;

      seen.add(children);

      // An ARRAY of structures declares its member set on the ELEMENT, and the
      // path says so — `subjectId.identifiers[].format`.
      const here = codec.kind === "array" ? `${path}[]` : path;

      for (const member of children()) {
        if (member.required !== undefined) required.push(`${here}.${member.domain}`);

        visit(member.codec, `${here}.${member.domain}`);
      }
    };

    for (const spec of CLAIM_SPECS) visit(spec.codec, spec.domain);

    // RFC 9396 §2 on the authorization details `type`: "This field is REQUIRED."
    // RFC 9493 §3 on the Subject Identifier `format`: a Subject Identifier "MUST
    // conform to a specific Identifier Format and MUST contain a 'format' member
    // whose value is the name of that Identifier Format" — unconditional, where
    // that same section's PER-FORMAT demands (`email` for the Email format, `iss`
    // and `sub` for `iss_sub`) are conditional and stay in
    // `internal/utils/rules/sub-id-shape.ts`.
    // OIDC Core §5.1.1 mandates no `address` member at all — it says an
    // implementation "MAY return only a subset of the fields of an address" —
    // so the address member set carries no cell, and that absence is the point.
    // ⚠ The ACTOR set carries none either: RFC 8693 §4.1 makes an actor's members
    // "claims that identify the actor" without mandating one.
    // ⚠ `authorizationDetails[]`, with the brackets, is what the descending walk
    // reports and it is the more honest path: RFC 9396 §2 makes `type` REQUIRED on
    // an ELEMENT, not on the claim, and the tail-policy guard below already keys
    // that structure the same way. The shallow walk said `authorizationDetails`.
    expect(required).toEqual([
      "authorizationDetails[].type",
      "subjectId.format",
      "subjectId.identifiers[].format",
    ]);
  });

  test("each declared structure states what becomes of a member it does not declare", () => {
    // The tail policy decides whether an UNDECLARED member survives at all, and
    // if it does whether its key is rewritten on the way to a signed wire — so it
    // is a byte-level fact rather than a stylistic one. `address` extends a
    // lindorm type and takes the house case flip; an RFC 9396 element's remaining
    // fields are named by whoever registered its `type` (RFC 9396's own Figure 2
    // spells them `instructedAmount`, `creditorName`, `creditorAccount`), and an
    // RFC 8693 actor's are other specifications' JWT claim names, so a flip would
    // rewrite either into fields nobody reads.
    //
    // ⚠⚠ `"closed"` IS A RECORDED VALUE NOW, NOT A SENTINEL THIS TEST INVENTS.
    // The cell was `open?:` and this test read `structure.open ?? "closed"` — one
    // version earlier it FILTERED the undefined case out entirely, so a table
    // built from the defined values alone said nothing at all about the strictest
    // disposition there is, and a claim could be closed or opened with nothing
    // going red (which is what happened when `act`/`mayAct` were closed for one
    // step and then opened again). {@link ObjectCodec.open} is REQUIRED and
    // three-way, so the value is simply read: a structure that states nothing does
    // not reach this test at all, it fails to COMPILE — which is the only place a
    // structure nobody remembered to add to a test can be caught. NO registered
    // claim is closed today, and the table below is what says so.
    //
    // ⚠⚠ IT WALKS EVERY STRUCTURE, NOT EVERY CLAIM, AND THE DIFFERENCE WAS A REAL
    // HOLE. `open` sits on the CODEC, so a nested member declares its OWN — and a
    // walk that read only the claim's top-level codec said nothing about any
    // structure below it. Measured on the shallow version: removing
    // `open: "verbatim"` from the NESTED `act` member (which leaves the actor set
    // open at depth 1 and closed below, a defect this migration actually shipped
    // for one measurement) left this whole file 37/37 GREEN. Keyed by PATH so a
    // nested cell is named where it sits, and cycle-guarded on the `children`
    // thunk exactly as `internal/cose/cwt-spec.ts` does — RFC 8693's actor set
    // names itself, so a naive descent would not terminate.
    const tails: Record<string, string> = {};
    const seen = new Set<ObjectCodec>();

    const structureOf = (codec: ClaimCodec): ObjectCodec | undefined =>
      codec.kind === "object"
        ? codec
        : codec.kind === "array" && codec.of !== undefined
          ? codec.of
          : undefined;

    const visit = (codec: ClaimCodec, path: string): void => {
      const structure = structureOf(codec);
      if (structure === undefined) return;

      // An ARRAY of structures declares its member set on the ELEMENT, and the
      // path says so — `authorizationDetails[]`, not `authorizationDetails`.
      const here = codec.kind === "array" ? `${path}[]` : path;

      // ⚠ THE CYCLE GUARD IS ASKED FIRST, so a declaration reached twice is
      // recorded ONCE — at the first path that reaches it. `act.act.act` and
      // `mayAct.act` are the SAME member declaration as `act.act`, so recording
      // them would grow the table with repetitions of one cell and make a
      // genuinely new nesting harder to see. `act` and `mayAct` are each their own
      // codec literal, so both claims still appear.
      //
      // ⚠ KEYED ON THE CODEC, NOT ON THE `children` THUNK — and the difference is
      // the cell this test exists to freeze. `open` lives on the CODEC, so two
      // codecs sharing one `children` arrow while declaring DIFFERENT `open`
      // values would have the second silently skipped: the guard would miss
      // exactly the drift it was written to catch. No such pair exists today, and
      // the codec object is just as stable an identity for cutting the cycle
      // (`internal/cose/cwt-spec.ts` keys on the thunk because it reads no
      // per-codec cell, so either works there).
      if (seen.has(structure)) return;
      seen.add(structure);

      tails[here] = structure.open;

      for (const member of structure.children()) {
        visit(member.codec, `${here}.${member.domain}`);
      }
    };

    for (const spec of CLAIM_SPECS) visit(spec.codec, spec.domain);

    expect(tails).toEqual({
      act: "verbatim",
      "act.act": "verbatim",
      mayAct: "verbatim",
      "authorizationDetails[]": "verbatim",
      // ⭐ THE SECOND ROW IS THE ARRAY-OF-SELF. RFC 9493 §3.2.8 makes an aliased
      // identifier the same kind of object as the outer one, so the element codec
      // states its own tail; declaring it only on the claim would leave a Subject
      // Identifier open at the top and closed inside every alias, which is the
      // exact hole the actor set shipped for one measurement.
      subjectId: "verbatim",
      "subjectId.identifiers[]": "verbatim",
      address: "flip",
    });
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
