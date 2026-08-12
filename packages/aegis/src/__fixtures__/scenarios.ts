import type { Dict } from "@lindorm/types";
import type { OmitMode } from "../internal/utils/apply-omit.js";
import type { AegisProfile } from "../types/claims/domain/aegis-profile.js";
import type { AegisSensitive } from "../types/claims/domain/aegis-sensitive.js";
import type { DomainClaims } from "../types/claims/domain/domain-claims.js";
import type { BuiltInProfiles } from "../internal/profiles/built-in-profiles.js";
import type {
  AegisEncKey,
  AegisSignKey,
  AssertOptions,
  CweEncryptOptions,
  CwtClaimsWire,
  DecryptOptions,
  DomainAssert,
  DomainTokenHeader,
  EncryptData,
  EncryptOptions,
  JweEncryptOptions,
  JwtClaimsWire,
  ProfileContent,
  ProfileMintOptions,
  SignContext,
  ProfileVerifyOptions,
  SignStructuredTokenOptions,
  SignUnstructuredTokenOptions,
  TokenContent,
  TokenFormatTag,
  VerifyAssert,
  VerifyOptions,
} from "../types/index.js";

/**
 * The aegis PUBLIC-SURFACE scenario table — pure DATA, no behaviour.
 *
 * Every row is a `Given / When / Then` triple, and each of the three is an ARRAY
 * OF DISCRETE STEPS — Gherkin's And-steps. Every step names its verb from a
 * CLOSED enumerated set of string literals and carries plain JSON (no lambdas, no
 * closures, no function values anywhere in a row). That is the whole constraint:
 * this file is meant to absorb the package's public-surface suite (~8,700 lines
 * across 29 files) and may later be machine-converted to Gherkin, so a row must
 * be trivially serialisable and a step must be recognisable by name alone.
 *
 * ALL code lives in `run-scenario.ts` — the future Gherkin step-definition layer.
 * If a row needs a new capability, add a STEP there and a literal here; never a
 * function value in a row.
 *
 * A row states a CAPABILITY of aegis — a rule that holds for years and stands on
 * its own. Its `id` and `title` therefore describe the rule and never how or when
 * a shortfall in it was noticed, and never another row. `rationale` says WHY the
 * rule must hold (the specification requirement or the security property);
 * `knownDefect` is the only place the current code's shortfall is described, and
 * it is deleted when the row goes green. A table test holds that invariant —
 * `knownDefect` appears on EXACTLY the rows that currently fail — so a note about
 * anything else (why a green row will one day be retired, why a fixture is shaped
 * as it is) belongs in a `//` comment above the step it explains, never there.
 *
 * ⚠ Every option / content bag below is typed against the REAL public option type
 * it is forwarded to, so a misspelled knob (`trustBoundThumbprnt`) is a COMPILE
 * error rather than a silent no-op that leaves a row red for the wrong reason. A
 * row that must carry a deliberately-invalid value casts LOCALLY, with a comment
 * naming why; there is no blanket cast in the interpreter.
 *
 * ⚠ An outcome asserts on the error CLASS (plus optional `data`), NEVER on the
 * `code` string. Callers branch with `instanceof`; codes are diagnostic text and
 * the domain-layer ones are being renamed. `data` is the stable discriminator.
 *
 * ⚠ WHEN a row pins `data`: only where the rejection is OBSERVABLE today — i.e.
 * on a GREEN rejecting row, whose `data` was read off the real error. A rejecting
 * row that names a `knownDefect` has NO error to read yet, so any `data` on it
 * would be a guess about the shape the eventual fix throws; guess wrong and the
 * row stays red with the defect repaired, which is precisely the failure mode
 * that makes a row lie at the finish line. Class-only there, and pin the `data`
 * once the fix lands and the error can be read. (Rows whose error carries an
 * EMPTY `data` pin nothing — `toMatchObject({})` is satisfied by anything.)
 */

/** The two wire families. A row targets exactly one; `absentTwin` documents why the other has none. */
export type Wire = "jose" | "cose";

export type KeyFixture =
  | "ec-sig"
  | "ec-enc"
  | "oct-sig"
  | "oct-enc"
  | "okp-sig"
  | "okp-enc"
  | "rsa-sig"
  | "rsa-enc";

/**
 * The aegis error classes, as STRINGS so a row stays Gherkin-convertible. The
 * interpreter maps each to the real class and asserts `instanceof`. Assert the
 * broadest class the contract actually promises: `AegisError` is what a consumer
 * catches, so it is the class the package owes at every door.
 */
export type ErrorClassName =
  | "AegisError"
  | "AegisDomainError"
  | "AegisKeyError"
  | "JwtError"
  | "JwsError"
  | "JweError"
  | "CwtError"
  | "CwmError"
  | "CwsError"
  | "CweError"
  | "JoseError"
  | "CoseError"
  | "LindormError";

/** The claims-bearing / opaque signing namespaces (`aegis.<kit>.sign`). */
export type SignKit = "jwt" | "cwt" | "jws" | "cws";

// The per-namespace option types, each the EXACT bag its `IAegis` method takes.
// Declared here rather than inlined so a row and the real signature drift
// together or not at all.
export type StructuredSignOptions = SignStructuredTokenOptions & { key?: AegisSignKey };
export type JwsSignOptions = SignUnstructuredTokenOptions & { key?: AegisSignKey };
export type CwsSignOptions = JwsSignOptions & { omit?: OmitMode };
export type JweSealOptions = JweEncryptOptions & { key?: AegisEncKey };
export type CweSealOptions = CweEncryptOptions & { key?: AegisEncKey };

// ---------------------------------------------------------------------------
// GIVEN
// ---------------------------------------------------------------------------

/**
 * The vault residents a row needs BEYOND the baseline `ec-sig` signing key, which
 * every scenario context already holds. A row that signs and verifies with the
 * baseline key names no `keys` step at all.
 */
export type KeysGivenStep = { step: "keys"; keys: ReadonlyArray<KeyFixture> };

/** The instant the row runs at, ISO-8601. Absent means the table's default clock. */
export type ClockGivenStep = { step: "clock"; at: string };

/**
 * The `mint` construction, one member per built-in profile so `profile` and
 * `content` are correlated: naming `access_token` holds the content to
 * `AccessTokenContent` and a claim that profile does not admit fails the build.
 *
 * A runtime-registered custom profile has no member here on purpose — no row
 * registers one, and admitting `string` would reopen the exact fall-through
 * `ProfileContentFor` was written to close (a built-in name matching an open
 * member and compiling as the whole `SignContent` vocabulary). Add a member if a
 * row ever needs one.
 */
/**
 * A mint content bag with its CLAIMS CONTAINER split in two, so a claim NAME is
 * checked like every other key on the bag.
 *
 * - `claims`             — names the registry knows, whichever bucket they belong
 *                          to, so `nationalIdentityNumbr` is a compile error. All
 *                          three buckets are admitted on purpose: routing a
 *                          sensitive claim through the plain container is exactly
 *                          what the confidentiality gate has to survive.
 * - `unregisteredClaims` — a name the registry deliberately does NOT know. Open
 *                          by necessity: it IS the unregistered remainder, so
 *                          there is no vocabulary to check it against. Declaring
 *                          it separately is what makes the choice deliberate
 *                          instead of the default.
 *
 * The interpreter merges the two back into the single container the public API
 * takes. A profile whose content type carries no claims container keeps none —
 * `IdTokenContent` does not `Pick` `claims`, and that statement survives.
 */
type RegisteredClaims = Partial<DomainClaims & AegisProfile & AegisSensitive>;

type MintContent<C> = [C] extends [never]
  ? never
  : Omit<C, "claims"> &
      ("claims" extends keyof C
        ? { claims?: RegisteredClaims; unregisteredClaims?: Dict }
        : Record<never, never>);

export type MintGivenStep = {
  [P in keyof ProfileContent]: {
    step: "token";
    via: "mint";
    profile: P;
    content: MintContent<ProfileContent[P]>;
    options?: ProfileMintOptions;
  };
}[keyof ProfileContent];

/**
 * How the artifact under test comes into existence, discriminated by `via`.
 *
 * - `mint`           — the domain profile pipeline, `aegis.mint(profile, content, options)`.
 * - `kit-sign`       — a RAW namespace, `aegis.<kit>.sign(...)`. Passthrough: the
 *                      dict is signed verbatim in its own wire spelling, which is
 *                      the only way to put a shape mint refuses in front of verify.
 *                      For `jws`/`cws` (opaque) the dict IS the payload.
 *                      ⚠ The claims bag is OPEN by design — an unregistered wire
 *                      claim is the point of the passthrough, so no typo guard is
 *                      possible (or wanted) there. The OPTIONS are closed.
 * - `kit-encrypt`    — a RAW sealing namespace, `aegis.<kit>.encrypt(data, options)`.
 * - `domain-encrypt` — `aegis.encrypt(data, options)`, the domain confidentiality verb.
 */
export type TokenGivenStep =
  | MintGivenStep
  | {
      step: "token";
      via: "kit-sign";
      kit: "jwt";
      claims: JwtClaimsWire & Dict;
      options?: StructuredSignOptions;
    }
  | {
      step: "token";
      via: "kit-sign";
      kit: "cwt";
      claims: CwtClaimsWire & Dict;
      options?: StructuredSignOptions;
    }
  | {
      step: "token";
      via: "kit-sign";
      kit: "jws";
      claims: TokenContent;
      options?: JwsSignOptions;
    }
  | {
      step: "token";
      via: "kit-sign";
      kit: "cws";
      claims: TokenContent;
      options?: CwsSignOptions;
    }
  | {
      step: "token";
      via: "kit-encrypt";
      kit: "jwe";
      data: TokenContent;
      options?: JweSealOptions;
    }
  | {
      step: "token";
      via: "kit-encrypt";
      kit: "cwe";
      data: TokenContent;
      options?: CweSealOptions;
    }
  | { step: "token"; via: "domain-encrypt"; data: EncryptData; options?: EncryptOptions };

/**
 * NO token at all: a flat claim dict, for the static `Aegis.assert` /
 * `Aegis.matches` surface.
 */
export type ClaimsGivenStep = { step: "claims"; claims: Dict };

/** The steps that stock the world before the artifact exists. */
export type SetupGivenStep = KeysGivenStep | ClockGivenStep;

/** The step that produces the thing under test. Exactly one per row, and LAST. */
export type ArtifactGivenStep = TokenGivenStep | ClaimsGivenStep;

export type GivenStep = SetupGivenStep | ArtifactGivenStep;

/**
 * A row's GIVEN: any number of setup steps, then the artifact.
 *
 * The tuple shape is the point — the compiler, not a convention, enforces that a
 * row names EXACTLY ONE artifact and that the clock and the vault are settled
 * before it is built.
 */
export type Given = readonly [...ReadonlyArray<SetupGivenStep>, ArtifactGivenStep];

// ---------------------------------------------------------------------------
// WHEN
// ---------------------------------------------------------------------------

/**
 * The PROFILED verify act — `verify(profile, token, assert, options)`, the FOUR
 * positional overload. `options` is REQUIRED and is `ProfileVerifyOptions`, whose
 * `audience` (the verifier's own identity) is mandatory.
 *
 * ⚠ Kept a separate type from {@link PlainVerifyStep} so the arity is decided by
 * the STEP's shape and checked by the compiler. Putting options in the third slot
 * of the profiled call silently turns them into claim MATCHERS, which has
 * produced bogus results twice.
 */
export type ProfiledVerifyStep = {
  step: "verify";
  /**
   * ⚠ BOUND to the built-in names, matching the mint side. It was `string`, so
   * `profile: "acces_token"` compiled — and nothing downstream caught it either,
   * because `IAegis.verify`'s loose overload accepts any string. A row naming a
   * profile that does not exist fails for a reason that has nothing to do with
   * the capability it claims to state.
   *
   * A row registering a CUSTOM profile adds a member here; reopening this to
   * `string` would restore the hole.
   */
  profile: keyof BuiltInProfiles;
  assert?: VerifyAssert;
  options: ProfileVerifyOptions;
};

/** The profile-less verify act — `verify(token, assert, options)`, three positionals. */
export type PlainVerifyStep = {
  step: "verify";
  profile?: undefined;
  assert?: VerifyAssert;
  options?: VerifyOptions;
};

/**
 * The act under test.
 *
 * `mint` means the GIVEN's own construction is the act — the outcome is asserted
 * against the construction itself, and a `rejects` outcome is a build that must
 * refuse.
 */
export type WhenStep =
  | { step: "mint" }
  | { step: "parse" }
  | { step: "decrypt"; options?: DecryptOptions }
  | ProfiledVerifyStep
  | PlainVerifyStep
  | { step: "kit-verify"; kit: SignKit }
  | { step: "static-assert"; assert: DomainAssert; options?: AssertOptions };

/** A row's WHEN: at least one act, run in order; the LAST one's result is asserted. */
export type When = readonly [WhenStep, ...ReadonlyArray<WhenStep>];

// ---------------------------------------------------------------------------
// THEN
// ---------------------------------------------------------------------------

/** The act completed. `format` names the encoding the artifact came back as. */
export type AcceptsThenStep = { step: "accepts"; format?: TokenFormatTag };

/** The act threw. A rejection is the whole outcome — there is nothing left to observe. */
export type RejectsThenStep = {
  step: "rejects";
  error: ErrorClassName;
  data?: Dict;
};

/**
 * A RAW WIRE KEY: a JOSE parameter/claim NAME (`typ`, `jti`) or a COSE integer
 * LABEL (`4`, `-70000`). NEVER a domain name — the wire steps report and compare
 * in the wire's own vocabulary, which is the only vocabulary an independent
 * reader has.
 *
 * ⚠ RFC 9052 §1.5 defines `label = int / tstr`, so the integer `4` and the text
 * string `"4"` are DIFFERENT COSE labels and a row naming one never matches the
 * other. That is deliberate: conflating them is precisely the class of mistake
 * these steps exist to catch.
 */
export type WireKey = string | number;

/**
 * What a row asserts about ONE raw wire bucket. All three lists are optional and
 * every one that is present is checked.
 *
 * - `includes` — the bucket carries these keys with these VALUES. ⚠ Compared
 *   against the RAW decoded value, so a parameter the wire carries as a byte
 *   string (a COSE `kid`, a CWT `cti`) will not equal the text it spells; assert
 *   its PRESENCE instead.
 * - `present`  — the bucket carries these keys, whatever the value. This is how a
 *   byte-string-valued parameter is asserted.
 * - `excludes` — the bucket carries no such key at all.
 */
export type WireAssertion = {
  includes?: Dict;
  present?: ReadonlyArray<WireKey>;
  excludes?: ReadonlyArray<WireKey>;
};

export type ObservationThenStep =
  /**
   * The expected DOMAIN claims, typed against the real `DomainClaims` — so a
   * misspelled EXPECTATION (`confirmaton`) is a COMPILE error, not a silent red
   * indistinguishable from the shortfall the row states. The same typo guard the
   * GIVEN side already has, now on the THEN side.
   */
  | { step: "claims"; expected: Partial<DomainClaims> }
  /**
   * ⚠ The custom bucket stays OPEN, and must: it IS the unregistered remainder,
   * so there is no closed vocabulary to check a name against. And a
   * domain-LOOKING name legitimately lands here — an `expires_at` arriving as
   * `expiresAt` is exactly that — so a "must not be a domain claim name" guard
   * would reject the very divergence a row would exist to state.
   */
  | { step: "custom"; expected: Dict }
  /**
   * The expected INTEGRITY-PROTECTED domain header fields — typed for the same
   * reason as `claims`. `excludes` names the fields that must NOT have reached
   * it: a parameter the signature does not cover must never be readable here.
   */
  | {
      step: "header";
      expected: Partial<DomainTokenHeader>;
      excludes?: ReadonlyArray<keyof DomainTokenHeader>;
    }
  /**
   * The UNAUTHENTICATED domain header bucket. `absent: true` asserts the result
   * carries NO such bucket, which is what a JOSE compact token must report:
   * RFC 7515 §7.1 — "Only one signature/MAC is supported by the JWS Compact
   * Serialization and it provides no syntax to represent a JWS Unprotected
   * Header value."
   *
   * ⚠ Absence and emptiness are separate assertions on purpose. An empty object
   * is TRUTHY, so a consumer writing `if (result.unprotectedHeader)` would read
   * one as a bucket that exists and then read `algorithm` — a field the domain
   * header declares NON-optional — as `undefined`.
   */
  | { step: "unprotectedHeader"; absent: true }
  | {
      step: "unprotectedHeader";
      absent?: undefined;
      expected?: Partial<DomainTokenHeader>;
      excludes?: ReadonlyArray<keyof DomainTokenHeader>;
    }
  /**
   * Assertions against the token's CLEARTEXT wire payload. ⚠ A payload the
   * interpreter cannot read (a JWE's ciphertext, a malformed token) FAILS the row
   * — it does not pass vacuously. An encryption row therefore asserts `format`,
   * and reaches for this step only where a cleartext payload exists to inspect.
   *
   * ⚠ Stays `Dict` deliberately: these are WIRE names, and an unregistered wire
   * claim is exactly what a passthrough row puts on the wire, so no closed
   * vocabulary exists here either.
   */
  | {
      step: "wirePayload";
      includes?: Dict;
      excludes?: ReadonlyArray<string>;
    }
  /**
   * Assertions against the token's RAW BYTES, read by the INDEPENDENT wire
   * inspector (`inspect-token.ts`) — which imports nothing from `internal/` or
   * `classes/` and therefore cannot be fooled by a mint bug and a read bug that
   * mirror each other. Every other wire assertion in this table goes through
   * aegis's own decoder, so it proves self-consistency and not correctness.
   *
   * Keys are RAW: integer labels on COSE, wire names on JOSE.
   *
   * ⚠ A bucket or payload the inspector cannot read FAILS the row rather than
   * passing vacuously — an inclusion or exclusion over an absent container never
   * fails, so a row could claim a value never reached the wire without looking.
   */
  | ({ step: "wireProtectedHeader" } & WireAssertion)
  /**
   * The raw UNPROTECTED bucket. `absent: true` asserts the wire has NO such
   * bucket at all, which is the JOSE compact serialisation's answer (RFC 7515
   * §7.1); a COSE structure always carries one (RFC 9052 §3), possibly empty.
   */
  | { step: "wireUnprotectedHeader"; absent: true }
  | ({ step: "wireUnprotectedHeader"; absent?: undefined } & WireAssertion)
  /** The raw claims payload — integer CWT labels on COSE, JOSE claim names on JOSE. */
  | ({ step: "wireClaims" } & WireAssertion);

export type ThenStep = AcceptsThenStep | RejectsThenStep | ObservationThenStep;

/**
 * A row's THEN: the verdict first, then one step per further observable
 * consequence. Compiler-enforced — a rejection admits no observations, because
 * there is no result to observe, and an observation without a verdict would
 * assert against whatever the act happened to leave behind.
 */
export type Then =
  | readonly [RejectsThenStep]
  | readonly [AcceptsThenStep, ...ReadonlyArray<ObservationThenStep>];

// ---------------------------------------------------------------------------
// SCENARIO
// ---------------------------------------------------------------------------

export type Scenario = {
  /**
   * A kebab-case slug naming the CAPABILITY, stable and greppable —
   * `a-token-with-no-expiry-is-refused`. It describes the rule, never the
   * occasion on which a shortfall in the rule was noticed.
   */
  id: string;
  /** Reads as a Gherkin scenario name: the capability as one sentence. */
  title: string;
  /**
   * WHY the rule must hold — the specification requirement or the security
   * property behind it. Durable: it reads as true whether or not the code
   * currently satisfies it. Public specifications are cited by section; internal
   * documents, commit identifiers and defect numbers are not.
   */
  rationale: string;
  /**
   * TRANSIENT — the mechanism by which the code falls short today, in file:line
   * terms, for whoever repairs it. DELETE THIS FIELD WHEN THE ROW GOES GREEN;
   * `rationale` is what survives. Present-tense and CHECKED: a table test asserts
   * this field is set on exactly the rows that currently fail.
   */
  knownDefect?: string;
  given: Given;
  when: When;
  then: Then;
  /**
   * Why this scenario has NO counterpart on the named wire — documentation of an
   * asymmetry, never a silent omission. It names the ABSENT twin's wire, so a row
   * never names its own (the table test asserts exactly that).
   */
  absentTwin?: Partial<Record<Wire, string>>;
};

// The deployment identity every row shares — the same one the seed suite uses.
export const ISSUER = "https://test.lindorm.io/";
export const RESOURCE = "https://rs.lindorm.io/";
export const CLIENT = "client-1";

/** The default clock: `2024-01-01T08:00:00.000Z`, in epoch seconds. */
export const NOW = 1704096000;

/** A real 32-byte base64url thumbprint (`Buffer.alloc(32, 7)`) — the COSE encoder refuses a short one. */
export const JKT = "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc";

/**
 * The id of the ES512 signing key every scenario context is built with — the
 * value a row expects to find in a `kid`. It is the fixture's own id, restated
 * here because a row carries literals and never reads one out of a key object.
 */
export const SIG_KEY_ID = "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7";

const BACKCHANNEL_LOGOUT = "http://schemas.openid.net/event/backchannel-logout";

const NIN = "19900101-1234";

export const SCENARIOS: ReadonlyArray<Scenario> = [
  // ---------------------------------------------------------------------------
  // The audience floor.
  // ---------------------------------------------------------------------------
  {
    id: "audience-floor-reads-the-wire-audience-claim",
    title:
      "a token whose wire audience names someone else is refused even when it also carries a custom audience claim",
    rationale:
      "The audience floor is what stops a token minted for one resource being replayed at another: RFC 7519 §4.1.3 requires a verifier that does not identify itself in `aud`, when that claim is present, to reject the token. Only the registered wire claim states who the issuer meant it for. An unregistered custom claim that merely spells the same word differently carries no such statement, so it must never be able to answer the check on the wire claim's behalf — otherwise the presenter, not the issuer, decides the audience.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "jwt",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: ["someone-else"],
          audience: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
        },
      },
    ],
    when: [{ step: "verify", profile: "default", options: { audience: RESOURCE } }],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "audience-floor-is-not-satisfied-by-a-look-alike-when-the-wire-claim-is-absent",
    title:
      "a token that states no audience at all is refused, even when it carries a custom audience claim",
    rationale:
      "RFC 7519 §4.1.3 makes `aud` the claim by which an issuer names who a token is for. A token that omits it names nobody, so a verifier identifying itself cannot be in it. The check therefore has to fail on ABSENCE as well as on mismatch — a rule that only compares the registered claim WHEN PRESENT lets a presenter supply a look-alike of its own and be believed, which hands the audience decision to the party the check exists to constrain.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "jwt",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          // No `aud`. The look-alike is the only audience-shaped claim present.
          audience: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
        },
      },
    ],
    when: [{ step: "verify", profile: "default", options: { audience: RESOURCE } }],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "a-non-matching-wire-audience-is-refused",
    title: "a token whose wire audience names someone else is refused",
    rationale:
      "RFC 7519 §4.1.3 — when `aud` is present, a verifier that does not identify itself in it MUST reject the token.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "jwt",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: ["someone-else"],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
        },
      },
    ],
    when: [{ step: "verify", profile: "default", options: { audience: RESOURCE } }],
    // The `data` pins the audience the refusal READ, so the rejection is
    // attributable to the audience check itself rather than to whatever
    // unrelated rule happened to fire first.
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: { audience: ["someone-else"] },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Proof-of-possession bindings.
  // ---------------------------------------------------------------------------
  {
    id: "a-confirmation-the-wire-cannot-carry-is-refused-at-mint",
    title:
      "a CWT mint refuses a confirmation whose thumbprint the COSE wire cannot carry",
    rationale:
      "A token that claims to be bound but is not is strictly worse than a bearer token, because the verifier stops asking for a proof. RFC 8747 defines no `jkt` member for a COSE confirmation, and a JOSE thumbprint cannot be re-labelled as a COSE one: RFC 7638 hashes a key's canonical JSON, RFC 9679 its canonical CBOR, so the same key yields DIFFERENT bytes and emitting one under the other's label would mislabel the digest and fail against any conformant verifier. A confirmation the wire cannot carry must therefore fail closed at mint rather than be dropped on the way out. ⚠ This row consequently asserts that the MINT refuses, not that a bound CWT verifies — under the fail-closed rule a proof-of-possession CWT is not mintable at all until a real COSE key thumbprint can be derived from the confirmed key, which is a separate capability.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "access_token",
        content: {
          subject: "user-1",
          audience: [RESOURCE],
          clientId: CLIENT,
          confirmation: { thumbprint: JKT, keyId: "k1" },
        },
        options: { format: "cwt" },
      },
    ],
    when: [{ step: "mint" }],
    // The `data` names the member the refusal READ, so it is attributable to the
    // thumbprint having no COSE form rather than to the confirmation being
    // unusable for some other reason. `keyId` IS representable and is absent
    // from the list, which is what makes this a per-MEMBER refusal rather than
    // the old all-or-nothing one.
    then: [{ step: "rejects", error: "CoseError", data: { members: ["jkt"] } }],
  },
  {
    id: "a-bound-token-without-a-proof-is-refused",
    title:
      "a token carrying a confirmation is refused when the verifier is shown no proof of possession",
    rationale:
      "RFC 7800 §3 — by including a confirmation claim the issuer declares that the presenter possesses a particular key and that the recipient can cryptographically confirm that possession. A verifier handed no proof has nothing to check the binding against, so it must refuse rather than quietly fall back to bearer semantics.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "access_token",
        content: {
          subject: "user-1",
          audience: [RESOURCE],
          clientId: CLIENT,
          confirmation: { thumbprint: JKT, keyId: "k1" },
        },
      },
    ],
    when: [{ step: "verify", profile: "access_token", options: { audience: RESOURCE } }],
    // No `data`: the error carries none, so there is nothing to pin. What makes
    // this refusal attributable is the companion row below — the SAME token, the
    // same profile, differing only in `trustBoundThumbprint`, and it verifies.
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "a-bound-token-verifies-when-the-caller-vouches-for-the-binding",
    title:
      "a token carrying a confirmation verifies when the caller states the binding is already proven",
    rationale:
      "The proof-of-possession floor must refuse exactly the presentations that show no proof, and no others. `trustBoundThumbprint` is how a caller states the binding was already checked ahead of it — a gateway that validated the proof and forwarded the token — so a floor that refused a confirmed token even then would make RFC 7800 binding unusable behind any such deployment, and deployments would drop the confirmation instead.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "access_token",
        content: {
          subject: "user-1",
          audience: [RESOURCE],
          clientId: CLIENT,
          confirmation: { thumbprint: JKT, keyId: "k1" },
        },
      },
    ],
    when: [
      {
        step: "verify",
        profile: "access_token",
        options: { audience: RESOURCE, trustBoundThumbprint: true },
      },
    ],
    then: [{ step: "accepts", format: "jwt" }],
  },

  // ---------------------------------------------------------------------------
  // Confidentiality of sensitive claims.
  // ---------------------------------------------------------------------------
  {
    id: "sensitive-claims-are-never-published-in-cleartext",
    title:
      "a claim the registry categorises as sensitive forces an encrypted token whichever container carried it",
    rationale:
      "A claim is sensitive because of WHAT IT IS, not because of which container the caller happened to put it in. A national identity number on a cleartext wire is disclosed to every intermediary that handles the token and to anything that logs it, and the disclosure is irreversible. The confidentiality decision must therefore key off the claim registry's category, so that no input shape can route a sensitive value around it.",
    given: [
      { step: "keys", keys: ["ec-enc"] },
      {
        step: "token",
        via: "mint",
        profile: "userinfo",
        content: {
          subject: "user-1",
          audience: [CLIENT],
          claims: { nationalIdentityNumber: NIN },
        },
      },
    ],
    when: [{ step: "mint" }],
    // No `wirePayload` exclusion. A JWE's payload is ciphertext, so `format: "jwe"`
    // IS the exclusion for an encrypted artifact; asserting one here would make
    // the row UNSATISFIABLE in BOTH directions — today the format is `jwt` and the
    // exclusion is never reached, and once the gate keys off the registry the
    // payload is unreadable and the interpreter fails the row on principle. The
    // reachable-cleartext half is a capability of its own, below.
    then: [{ step: "accepts", format: "jwe" }],
    absentTwin: {
      cose: "the same gate is in mint-token.ts, shared by both encoders — a COSE twin would exercise the identical line",
    },
  },
  {
    id: "a-sensitive-claim-is-omitted-when-it-cannot-be-encrypted",
    title:
      "a sensitive claim is left out of the token entirely when no recipient key is available",
    rationale:
      "Confidentiality has to fail CLOSED. When a sensitive claim cannot be sealed — no recipient key is resolvable — the only safe outcome is to omit it: signing it in the clear would disclose it to every intermediary and to anything that logs the token, irreversibly, while the caller believes the sensitivity marking did something. Omission costs the audience a claim; emission costs the subject the value.",
    given: [
      // No `keys` step: the vault holds only the signing key, so the encryption
      // this content would otherwise force is unavailable.
      {
        step: "token",
        via: "mint",
        profile: "userinfo",
        content: {
          subject: "user-1",
          audience: [CLIENT],
          claims: { nationalIdentityNumber: NIN, nickname: "nick" },
        },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      { step: "accepts", format: "jwt" },
      // The NON-sensitive neighbour rides the same container, so its presence is
      // what shows the claim was removed for what it IS and not because the
      // container was discarded wholesale.
      { step: "wirePayload", includes: { nickname: "nick" } },
      { step: "wirePayload", excludes: ["national_identity_number"] },
    ],
    absentTwin: {
      cose: "the strip is in mint-token.ts, above the wire seam — a COSE twin would exercise the identical line",
    },
  },
  {
    id: "claims-container-content-is-published-in-cleartext",
    title:
      "a claim supplied through the claims container is published on the cleartext wire",
    rationale:
      "The `claims` container is the caller's route for additional NON-confidential claims: its content is spread onto the domain layer verbatim and published for the audience to read. Stating where the cleartext boundary sits is what makes any movement of that boundary visible rather than silent.",
    given: [
      { step: "keys", keys: ["ec-enc"] },
      {
        step: "token",
        via: "mint",
        profile: "userinfo",
        content: {
          subject: "user-1",
          audience: [CLIENT],
          // ⚠ The claim is deliberately one the registry does NOT categorise as
          // sensitive. This row once carried a national identity number and was
          // RETIRED by the move to a registry-category encryption gate: the gate
          // is profile-independent but for `profile.encryptable`, so that mint now
          // produces an encrypted token and the cleartext assertion could no
          // longer be checked. Re-anchored rather than deleted, because the
          // container boundary is still worth stating — and stating it on a
          // NON-sensitive claim is what keeps the two capabilities from asserting
          // the same thing.
          //
          // It is also a name the registry does not know at all, so it is
          // declared as such rather than through the registered half.
          unregisteredClaims: { favouriteColour: "green" },
        },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      { step: "accepts", format: "jwt" },
      { step: "wirePayload", includes: { favourite_colour: "green" } },
    ],
  },
  {
    id: "a-sensitive-claim-forces-an-encrypted-token",
    title:
      "a claim supplied through the sensitive container is delivered as an encrypted token",
    rationale:
      "Confidentiality of a sensitive claim is delivered by SEALING the token, not by omitting the claim — the audience still needs the value. So an encryptable profile handed a sensitive container must produce an encrypted artifact, and that is what makes encryption an available outcome for the profile at all.",
    given: [
      { step: "keys", keys: ["ec-enc"] },
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: {
          subject: "user-1",
          audience: [CLIENT],
          sensitive: { nationalIdentityNumber: NIN },
        },
        options: { context: { accessTokenIssued: false } },
      },
    ],
    when: [{ step: "mint" }],
    // No `wirePayload` exclusion: a JWE's payload is ciphertext, so the exclusion
    // could only ever pass vacuously. `format: "jwe"` IS the exclusion here.
    then: [{ step: "accepts", format: "jwe" }],
  },

  // ---------------------------------------------------------------------------
  // Critical header parameters.
  // ---------------------------------------------------------------------------
  {
    id: "an-unrecognised-critical-parameter-is-refused-on-the-cose-wire",
    title: "a CWT marking an unrecognised header parameter critical is refused",
    rationale:
      "RFC 9052 §3.1 — `crit` names the protected header parameters a processor is REQUIRED to understand; refusing the message is the only way to honour that for a parameter it does not understand (RFC 7515 §4.1.11 states the JOSE twin explicitly: a JWS whose `crit` names an extension the recipient does not understand and support is invalid). The requirement is identical on both wires, and an enforcement present on one but absent on the other means the same hostile token is refused or accepted depending only on its encoding, which is a choice the attacker makes.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "cwt",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          cti: "token-1",
        },
        options: { header: { crit: ["oid"], oid: "1.2.3.4" } },
      },
    ],
    when: [{ step: "verify" }],
    // The same `data` its JOSE twin pins, which is the point: ONE enforcement
    // serves both wires, so the refusal is attributable to the
    // unrecognised-extension branch on either. Reaching that branch on this wire
    // required settling what a COSE crit MEMBER is — RFC 9052 §1.5 makes it a
    // label, so the writer emits the integer label the parameter is keyed under
    // and the reader translates it back to the JOSE name the enforcement reads.
    then: [{ step: "rejects", error: "CoseError", data: { param: "oid" } }],
  },
  {
    id: "an-unrecognised-critical-parameter-is-refused",
    title: "a token marking an unrecognised header parameter critical is refused",
    rationale:
      "RFC 7515 §4.1.11 — if any of the extension header parameters listed in `crit` are not understood and supported by the recipient, the JWS is invalid. aegis implements no crit extension, so every parameter a producer marks critical is by definition unrecognised.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "jwt",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
        },
        options: { header: { crit: ["oid"], oid: "1.2.3.4" } },
      },
    ],
    when: [{ step: "verify" }],
    // The `data` pins the parameter the refusal READ, so it is attributable to
    // the unrecognised-extension branch rather than to a malformed `crit`. `oid`
    // is a REAL header parameter that is NOT IANA-registered, so the
    // registered-parameter and presence branches both pass and the token reaches
    // that branch.
    then: [{ step: "rejects", error: "JwtError", data: { param: "oid" } }],
  },

  // ---------------------------------------------------------------------------
  // Token lifetime.
  // ---------------------------------------------------------------------------
  {
    id: "expiry-presence-cannot-be-satisfied-by-a-look-alike-claim",
    title:
      "a CWT with no exp is refused by the profile floor even when it carries a custom expires_at claim",
    rationale:
      "RFC 7519 §4.1.4 and RFC 8392 §3.1.4 — expiry is stated by the registered `exp` claim and by nothing else. A presence check that an unregistered claim can satisfy merely by resembling the registered one lets a producer hand out a token with no enforceable lifetime, which the verifier then honours indefinitely.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "cwt",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          iat: NOW,
          cti: "token-1",
          client_id: CLIENT,
          expires_at: 978307200,
        },
        options: { tokenType: "at" },
      },
    ],
    when: [{ step: "verify", profile: "access_token", options: { audience: RESOURCE } }],
    then: [{ step: "rejects", error: "AegisDomainError" }],
    absentTwin: {
      jose: "COSE-ONLY. The JOSE floor read keeps an unresolved key VERBATIM (the `floor` mode of translate.ts's wireToDomain), so a JOSE `expires_at` never becomes `expiresAt` and the JOSE floor already refuses — a JOSE twin would assert a rule that is not at risk on that wire",
    },
  },
  {
    id: "an-access-token-with-no-expiry-is-refused",
    title: "an access token carrying no expiry claim is refused",
    rationale:
      "RFC 8392 §3.1.4 defines the CWT `exp` claim, and the aegis access-token floor requires it to be PRESENT: a token that states no lifetime never expires, so a verifier has to refuse it outright rather than supply a default the issuer never authorised. ⚠ The presence requirement is AEGIS POLICY here, not a citation. RFC 9068 §2.2 makes `exp` REQUIRED but governs the JWT ENCODING only — it is the JWT profile for OAuth 2.0 access tokens and its §2.1 mandates `typ: at+jwt` — and no RFC-level CWT access-token profile makes `exp` required at all: RFC 8392 §3 inherits RFC 7519's wording that use of the claim is OPTIONAL. The policy is deliberately encoding-independent, because a lifetime a verifier cannot enforce is the same hazard on either wire; the JOSE profile is what it is modelled on.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "cwt",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          iat: NOW,
          cti: "token-1",
          client_id: CLIENT,
        },
        options: { tokenType: "at" },
      },
    ],
    when: [{ step: "verify", profile: "access_token", options: { audience: RESOURCE } }],
    // No `data`: the error carries an EMPTY one, and `toMatchObject({})` is
    // satisfied by anything.
    then: [{ step: "rejects", error: "AegisDomainError" }],
    absentTwin: {
      jose: "the same floor already refuses an exp-less JOSE token through the JOSE path — a JOSE twin would assert a rule that is not at risk on that wire",
    },
  },

  // ---------------------------------------------------------------------------
  // The verified domain header.
  //
  // The other half of this capability — a `typ` the signature does not cover —
  // cannot be expressed as a row, because its input is unmintable, and lives in
  // `internal/cose/unprotected-typ.test.ts`. This half CAN: an `oid` in the
  // protected header is mintable through the public surface, reaches the wire,
  // and is then dropped on the way to the domain header.
  // ---------------------------------------------------------------------------
  {
    id: "protected-header-parameters-reach-the-verified-header-on-the-cose-wire",
    title:
      "a CWT's integrity-protected object identifier reaches the verified domain header",
    rationale:
      "The verified domain header is what a caller inspects to route, audit and police a token, so every parameter the signature covers has to reach it. A protected parameter dropped on the way out is a statement the issuer signed and the consuming code can never see.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "cwt",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          cti: "token-1",
        },
        options: { header: { oid: "1.2.3.4" } },
      },
    ],
    when: [{ step: "verify" }],
    // The token carries NO `crit`, which is what keeps this row independent of
    // critical-parameter enforcement: it is mintable and verifiable today and
    // stays so under every repair listed in this table.
    then: [
      { step: "accepts", format: "cwt" },
      { step: "header", expected: { objectId: "1.2.3.4" } },
    ],
  },
  {
    id: "protected-header-parameters-reach-the-verified-header",
    title: "a JWT's object identifier header reaches the verified domain header",
    rationale:
      "What a caller can see of a token must not depend on the encoding the issuer chose for it.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "jwt",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
        },
        options: { header: { oid: "1.2.3.4" } },
      },
    ],
    when: [{ step: "verify" }],
    // Green today because `parseTokenHeader` runs a data-driven pass over the
    // WHOLE decoded wire header, so a private-use parameter resolves through the
    // header registry to its domain name. The COSE twin above does not.
    then: [
      { step: "accepts", format: "jwt" },
      { step: "header", expected: { objectId: "1.2.3.4" } },
    ],
  },

  // ---------------------------------------------------------------------------
  // Mint-time facts a token's claims do not carry.
  // ---------------------------------------------------------------------------
  {
    id: "an-id-token-mint-must-state-whether-an-access-token-was-co-issued",
    title:
      "minting an id_token without stating whether an access token was co-issued is refused",
    rationale:
      'OIDC Core \u00a73.1.3.6 requires `at_hash` in an id_token issued from the implicit and hybrid flows, and aegis requires it whenever an access token co-issues. Whether one did is a fact only the issuer holds \u2014 it is not in the claims, and nothing about the token distinguishes "no access token was issued" from "the issuer forgot to say". Treating the unstated case as `false` therefore silently issues the exact token the rule exists to prevent, so the fact must be supplied rather than assumed.',
    given: [
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: { subject: "user-1", audience: [CLIENT], accessToken: "at-1" },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: { missing: ["accessTokenIssued"] },
      },
    ],
    absentTwin: {
      cose: "the policy runs above the wire seam in mint-token.ts, so a COSE twin would exercise the identical line",
    },
  },
  {
    id: "a-misspelled-mint-context-key-does-not-answer-for-the-one-a-rule-reads",
    title:
      "minting an id_token with a context bag that misspells the co-issuance key is refused",
    rationale:
      'A rule reading a fact under a name nobody supplied evaluates the fact as absent, which for a boolean reads as false \u2014 so a misspelled key is not an error, it is a silent answer of "no". A supplied bag is therefore no evidence that the fact was supplied: the check has to be on the NAME the rule reads, or the guard against an omitted fact is defeated by any bag at all.',
    given: [
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: { subject: "user-1", audience: [CLIENT], accessToken: "at-1" },
        options: {
          // \u26a0 LOCAL cast, deliberate: `SignContext` is a CLOSED record, so this
          // misspelling does not compile \u2014 which is the type-level half of the
          // same capability. The cast is what lets the row state the RUNTIME half,
          // for a caller reaching the API from untyped code.
          context: { accessTokenIssud: false } as unknown as SignContext,
        },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: { missing: ["accessTokenIssued"] },
      },
    ],
  },
  {
    id: "a-required-claim-supplied-empty-is-not-supplied",
    title: "minting a token whose required claim is an empty string is refused",
    rationale:
      'A subject identifier of `""` names nobody, so a presence rule satisfied by one guarantees nothing while reporting that it does. Presence has to mean the same thing at issue and on arrival: a verifier has always read an empty required claim as missing, and an issuer that reads it as present mints tokens its own verifier will refuse.',
    given: [
      {
        step: "token",
        via: "mint",
        profile: "userinfo",
        content: { subject: "", audience: [CLIENT] },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: {
          direction: "mint",
          invalid: [{ key: "subject", message: 'Required claim "subject" is missing' }],
        },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Logout tokens.
  // ---------------------------------------------------------------------------
  {
    id: "a-logout-token-must-identify-a-subject-or-a-session",
    title:
      "a logout token naming neither a subject nor a session is refused — it identifies nothing to log out",
    rationale:
      "OpenID Connect Back-Channel Logout 1.0 §2.4 — a logout token MUST contain a `sub`, a `sid`, or both, and a relying party handed neither has nothing to terminate. The requirement is on the token a verifier RECEIVES, so it has to be checked at verify: a rule enforced only at mint constrains this issuer's own output and says nothing about the token that actually arrived.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "jwt",
        claims: {
          iss: ISSUER,
          aud: [CLIENT],
          iat: NOW,
          exp: NOW + 120,
          jti: "token-1",
          events: { [BACKCHANNEL_LOGOUT]: {} },
        },
        options: { tokenType: "logout" },
      },
    ],
    when: [{ step: "verify", profile: "logout_token", options: { audience: CLIENT } }],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "a-logout-token-naming-a-subject-verifies",
    title: "a logout token naming a subject verifies",
    rationale:
      "OpenID Connect Back-Channel Logout 1.0 §2.4 — a `sub` alone satisfies the identification requirement. A floor that refused a logout token naming one would break every conformant back-channel logout, so the identification rule must reject exactly the tokens that identify nothing and no others.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "jwt",
        claims: {
          iss: ISSUER,
          aud: [CLIENT],
          sub: "user-1",
          iat: NOW,
          exp: NOW + 120,
          jti: "token-1",
          events: { [BACKCHANNEL_LOGOUT]: {} },
        },
        options: { tokenType: "logout" },
      },
    ],
    when: [{ step: "verify", profile: "logout_token", options: { audience: CLIENT } }],
    then: [{ step: "accepts", format: "jwt" }],
  },

  // ---------------------------------------------------------------------------
  // Caller-supplied key policy.
  // ---------------------------------------------------------------------------
  {
    id: "verify-honours-a-caller-supplied-key-policy",
    title:
      "a caller-supplied key policy is applied when verifying an opaque JOSE signature",
    rationale:
      "A key policy is the caller's constraint on which key material may verify a token — an algorithm floor is how a deployment refuses an algorithm downgrade. A policy silently dropped on one code path is worse than no policy at all, because the caller believes the constraint is in force and stops checking.",
    given: [{ step: "token", via: "kit-sign", kit: "jws", claims: { hello: "world" } }],
    when: [{ step: "verify", options: { key: { condition: { algorithm: "RS256" } } } }],
    then: [{ step: "rejects", error: "AegisKeyError" }],
  },
  {
    id: "verify-honours-a-caller-supplied-key-policy-on-the-cose-wire",
    title:
      "a caller-supplied key policy is applied when verifying an opaque COSE signature",
    rationale:
      "The same constraint on the COSE wire: the algorithm floor a caller states decides which key may verify the signature, whichever encoding carries it. A policy that holds on one wire and not the other is a policy an attacker chooses to be bound by.",
    given: [{ step: "token", via: "kit-sign", kit: "cws", claims: { hello: "world" } }],
    when: [{ step: "verify", options: { key: { condition: { algorithm: "RS256" } } } }],
    then: [{ step: "rejects", error: "AegisKeyError" }],
  },

  // ---------------------------------------------------------------------------
  // The error contract — every door.
  // ---------------------------------------------------------------------------
  {
    id: "a-token-failure-is-always-an-aegis-error-at-the-kit-verify-door",
    title: "an expired token rejected by a kit verify throws an AegisError",
    rationale:
      "`AegisError` is the class a consumer catches — pylon branches on `instanceof AegisError` to turn a token rejection into a 401. Every failure aegis raises must therefore BE one, at every door, or the rejection falls through the consumer's guard and surfaces as a generic 500 that tells the caller nothing about the token.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "jwt",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW - 3600,
          iat: NOW - 7200,
          jti: "token-1",
        },
      },
    ],
    when: [{ step: "kit-verify", kit: "jwt" }],
    then: [{ step: "rejects", error: "AegisError" }],
  },
  {
    id: "a-token-failure-is-always-an-aegis-error-at-the-domain-verify-door",
    title: "an expired token rejected by the domain verify verb throws an AegisError",
    rationale:
      "`AegisError` is the class a consumer catches, and the domain verify verb is the door most of them use. A failure raised there that is not an `AegisError` defeats every `instanceof` guard written against the package.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "jwt",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW - 3600,
          iat: NOW - 7200,
          jti: "token-1",
        },
      },
    ],
    when: [{ step: "verify" }],
    then: [{ step: "rejects", error: "AegisError" }],
  },
  {
    id: "a-token-failure-is-always-an-aegis-error-at-the-static-assert-door",
    title: "a failing static claim assertion throws an AegisError",
    rationale:
      "`AegisError` is the class a consumer catches, and the static claim-matching surface is a door like any other: a caller that wraps `Aegis.assert` in the same guard as a verify must catch the same class.",
    given: [{ step: "claims", claims: { subject: "user-1" } }],
    when: [{ step: "static-assert", assert: { subject: "someone-else" } }],
    then: [{ step: "rejects", error: "AegisError" }],
  },

  // ---------------------------------------------------------------------------
  // The wire-neutral error contract.
  // ---------------------------------------------------------------------------
  {
    id: "a-domain-refusal-names-the-wire-it-refused",
    title: "a domain refusal of a JWT names the JWT encoding in its data",
    rationale:
      "A domain rule is one rule, so it raises ONE code on both encodings; but a consumer handling that refusal — logging it, rendering it, deciding whether to retry against a different endpoint — still has to know which encoding the refused token was in. That fact therefore has to travel as DATA on the error, because it is no longer in the code. This is aegis policy, not a specification requirement: no RFC says anything about the shape of an implementation's error. What makes it a rule worth pinning is the alternative it replaced — the wire baked into the code as a prefix, one spelling per encoding for a single rule, which forced every consumer to match two codes for one condition and reported a CWT's failure under a name that said JWT.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "jwt",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          // No `exp`. Expiry PRESENCE is the domain rule under test; the range
          // check belongs to the kit and is not what refuses this token.
          iat: NOW,
          jti: "token-1",
        },
      },
    ],
    when: [{ step: "verify" }],
    then: [{ step: "rejects", error: "AegisDomainError", data: { format: "jwt" } }],
  },
  {
    id: "a-domain-refusal-names-the-wire-it-refused-on-the-cose-wire",
    title: "a domain refusal of a CWT names the CWT encoding in its data",
    rationale:
      "The same rule refusing a COSE token must report the COSE encoding. A refusal that names the wrong encoding is worse than one that names none: it sends whoever reads it to the wrong decoder, the wrong issuer and the wrong half of the code, and it does so most convincingly when both wires share the one implementation that produced it.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "cwt",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          iat: NOW,
          cti: "token-1",
        },
      },
    ],
    when: [{ step: "verify" }],
    then: [{ step: "rejects", error: "AegisDomainError", data: { format: "cwt" } }],
  },

  // ---------------------------------------------------------------------------
  // Header provenance — what the signature covers, and what it does not.
  // ---------------------------------------------------------------------------
  {
    id: "an-unprotected-header-parameter-never-reads-as-signed-on-the-cose-wire",
    title:
      "a CWT's unprotected key identifier is reported apart from the parameters the signature covers",
    rationale:
      "RFC 9052 §3 gives a COSE object two header buckets: the protected one holds parameters that are 'cryptographically protected' and the unprotected one 'parameters about the current layer that are not cryptographically protected'. §3.1 puts the `kid` hint in the second — it 'is not a security-critical field. For this reason, it can be placed in the unprotected-header-parameters bucket'. Anything a verifier routes, audits or polices a token by must therefore say which bucket it came from: an unprotected parameter is written by whoever last held the token, so a reader that cannot tell the two apart decides policy on a value the PRESENTER chose while believing the issuer signed it.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "cwt",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          cti: "token-1",
        },
      },
    ],
    when: [{ step: "verify" }],
    // The two wire steps are the load-bearing half. Asserting only the domain
    // result would prove the two buckets are reported apart — not that the
    // parameter is in the bucket the report claims, which is the thing a reader
    // through aegis's own decoder cannot check.
    then: [
      { step: "accepts", format: "cwt" },
      { step: "header", expected: { algorithm: "ES512" }, excludes: ["keyId"] },
      { step: "unprotectedHeader", expected: { keyId: SIG_KEY_ID } },
      { step: "wireProtectedHeader", present: [1, 16], excludes: [4] },
      { step: "wireUnprotectedHeader", present: [4], excludes: [1, 16] },
    ],
    absentTwin: {
      jose: "JOSE compact serialisation has no unprotected bucket at all (RFC 7515 §7.1), so no parameter can arrive unsigned on that wire and there is nothing to keep apart",
    },
  },
  {
    id: "a-wire-with-no-unprotected-bucket-reports-none",
    title: "a JWT reports no unprotected header bucket at all",
    rationale:
      "RFC 7515 §7.1 — 'Only one signature/MAC is supported by the JWS Compact Serialization and it provides no syntax to represent a JWS Unprotected Header value.' Every parameter on a JWT is therefore covered by the signature, and the result must say so by reporting NO unprotected bucket. An empty object would not: it is truthy, so a consumer writing `if (result.unprotectedHeader)` reads it as a bucket that exists and then reads a field the header type declares non-optional as undefined. A header the wire does not have has to be absent, not empty.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "jwt",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
        },
      },
    ],
    when: [{ step: "verify" }],
    then: [
      { step: "accepts", format: "jwt" },
      // The contrast that makes the absence meaningful: the key identifier is
      // still reported — from the bucket the signature covers.
      { step: "header", expected: { keyId: SIG_KEY_ID } },
      { step: "unprotectedHeader", absent: true },
      { step: "wireProtectedHeader", present: ["kid", "alg", "typ"] },
      { step: "wireUnprotectedHeader", absent: true },
    ],
    absentTwin: {
      cose: "a COSE structure always carries an unprotected bucket (RFC 9052 §3), so the absence this row asserts cannot arise on that wire",
    },
  },

  // ---------------------------------------------------------------------------
  // The asserted token type.
  // ---------------------------------------------------------------------------
  {
    id: "an-asserted-token-type-is-compared-as-a-whole-media-type",
    title: "a JWT of another type is refused when the caller asserts an id token",
    rationale:
      "RFC 7519 §5.1 — the `typ` header parameter 'is used by JWT applications to declare the media type of this complete JWT', so a caller asserting a token IS of a given type is asserting on that whole media type. The comparison has to be made on the whole of it: a type whose media type is the bare conventional form — an id token is a plain `JWT` — has no structured prefix, so a check that compares prefixes has nothing to compare for exactly that type and silently accepts every token instead. An assertion that cannot fail is worse than an absent one, because the caller has stopped checking.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "jwt",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
        },
        options: { tokenType: "at" },
      },
    ],
    when: [{ step: "verify", assert: { tokenType: "id_token" } }],
    // The `data` pins the typ the refusal READ, so the rejection is attributable
    // to the type comparison rather than to any other rule this token would also
    // have to satisfy.
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: { typ: "application/at+jwt", format: "jwt" },
      },
    ],
  },
  {
    id: "an-asserted-token-type-is-compared-as-a-whole-media-type-on-the-cose-wire",
    title: "a CWT of another type is refused when the caller asserts an id token",
    rationale:
      "RFC 9596 §2 gives COSE the same parameter — `typ` (label 16) declares 'the type of this complete COSE object' — so the caller's type assertion means the same thing on this wire and must be enforced just as hard. An assertion honoured on one encoding and skipped on the other is an assertion the attacker chooses to be bound by, since the encoding is the issuer's choice and the presenter's opportunity.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "cwt",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          cti: "token-1",
        },
        options: { tokenType: "at" },
      },
    ],
    when: [{ step: "verify", assert: { tokenType: "id_token" } }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: { typ: "application/at+cwt", format: "cwt" },
      },
    ],
  },
  {
    id: "a-token-of-the-asserted-type-verifies",
    title: "a JWT typed as an id token verifies when the caller asserts an id token",
    rationale:
      "The type assertion must refuse exactly the tokens of another type and no others. An id token's media type is the bare conventional `JWT` (RFC 7519 §5.1 recommends that spelling and there is no registered structured form for it), so a comparison that got this wrong in the other direction — demanding a structured media type an id token never carries — would refuse every conformant id token in existence.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "jwt",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
        },
      },
    ],
    when: [{ step: "verify", assert: { tokenType: "id_token" } }],
    then: [
      { step: "accepts", format: "jwt" },
      // Read off the raw bytes: the media type the assertion matched is the one
      // the token actually carries, not the one aegis reconstructs on the way out.
      { step: "wireProtectedHeader", includes: { typ: "JWT" } },
    ],
  },
  {
    id: "a-token-of-the-asserted-type-verifies-on-the-cose-wire",
    title: "a CWT typed as an id token verifies when the caller asserts an id token",
    rationale:
      "The COSE counterpart of the same requirement. An id token's bare `JWT` media type has one COSE equivalent — `application/cwt`, the single CWT media type registered by RFC 8392 — so the assertion must accept exactly that and no other. Getting the accepting half wrong is how a type check is discovered to be too strict only in production, by a deployment whose tokens were conformant all along.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "cwt",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          cti: "token-1",
        },
      },
    ],
    when: [{ step: "verify", assert: { tokenType: "id_token" } }],
    then: [
      { step: "accepts", format: "cwt" },
      { step: "wireProtectedHeader", includes: { 16: "application/cwt" } },
    ],
  },
];
