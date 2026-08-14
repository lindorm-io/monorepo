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
  ParsedDpopProof,
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
  VerifyStructuredTokenOptions,
  AegisVerifyKey,
  AegisSettings,
} from "../types/index.js";

/**
 * The aegis PUBLIC-SURFACE scenario table — pure DATA, no behaviour.
 *
 * ⭐⭐ THIS FILE IS THE SPECIFICATION. AEGIS IS THE THING UNDER TEST.
 *
 * The single most important property of this table is that every row is CLEAR,
 * CORRECT AND MAKES SENSE ON ITS OWN — not that the suite is green. Where those
 * two pull against each other, the clarity and correctness of the table wins.
 * The table can only arbitrate what aegis owes if a reader can tell, from the
 * row alone, what the rule is and why; so a confusing row is worse than a
 * missing one, and improving a vague row is the work rather than a distraction
 * from it.
 *
 * ⚠ A RED ROW TRIGGERS A LOOK INTO AEGIS FIRST. ALWAYS, BEFORE ANYTHING ELSE.
 * The default reading of a failing cell is that aegis falls short of a
 * capability it owes — the usual reflex that the test is probably wrong is
 * INVERTED here. Read the code the row exercises and state the mechanism in
 * `file:line` terms before concluding anything.
 *
 *   - aegis is wrong ⇒ the row STAYS AT FULL STRENGTH and is pinned with
 *     {@link Scenario.knownDefect} (per wire where the shortfall is per wire),
 *     recorded in the project's open items, and reported. The code is repaired
 *     later; the row is not touched now.
 *   - the row is wrong ⇒ correct it, and say plainly WHAT was wrong and how
 *     reading the code established it. A corrected row is a FINDING and is
 *     reported as one, never folded in as cleanup.
 *
 * That conclusion has to be EARNED by reading aegis first. It is never the
 * opening move, and "the suite went red so the row was retuned" is not an
 * account of anything.
 *
 * ⚠ NEVER HIDE A ROW, at any point. No commenting out, no `.skip`, no deletion,
 * no quiet narrowing until it passes. A row that stays red stays red IN THE
 * SUITE, pinned and visible.
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

/**
 * The two wire families.
 *
 * ⚠ COVERAGE IS THE DEFAULT AND ABSENCE IS THE DECLARATION. A row states one
 * DOMAIN capability, and a capability of aegis is a capability on every wire
 * aegis speaks unless a specification forbids it — so a row runs on EVERY wire
 * and the only way to run on fewer is to say so in {@link Scenario.unsupported},
 * with the reason.
 *
 * That is the inversion of what this table did first: a row named a concrete kit
 * (`kit: "jwt"`) or a concrete `format`, which pinned it to one wire SILENTLY,
 * and the twin on the other wire existed only if somebody remembered to write
 * it. SIX rows were hand-written `-on-the-cose-wire` copies of another row, and
 * nothing said which of the remaining rows SHOULD have had one. Absence read
 * identically to deliberate omission, which is how a wire loses a rule.
 *
 * A row may still name a concrete wire — some capabilities genuinely are
 * one-wire (a raw COSE label assertion, a JOSE-only header parameter). It then
 * owes the other wire an `unsupported` entry, and the table's integrity test
 * enforces that debt.
 */
export type Wire = "jose" | "cose";

/**
 * A `Date`, as DATA — the one value the option and claim bags carry that JSON has
 * no literal for.
 *
 * A live `new Date(…)` in a row would compile (every bag bottoms out in `Dict`)
 * and then die in the table's own serialisability test, so the shape is spelled
 * explicitly and the interpreter revives it. The revival is RECURSIVE over the
 * whole row, so a cell is written wherever a `Date` belongs — a temporal claim in
 * a `claims` artifact, a `currentDate` in an assert option bag, a date-valued
 * profile claim inside a mint's content.
 *
 * ⚠ Narrow on purpose: a lone `date` member holding a string. A looser test would
 * start rewriting any claim that merely happens to carry one.
 */
export type DateCell = { readonly date: string };

/**
 * A key's RFC 7638 thumbprint, as DATA — the value a proof-of-possession
 * confirmation carries (`cnf.jkt`, RFC 9449 §6.1).
 *
 * Written as a cell for the same reason as {@link DateCell}: the digest is a
 * property of the key material, so a row that spelled it out as a literal would
 * be a second copy of it — one that keeps compiling, and keeps matching nothing,
 * the day the fixture key changes. The row names the KEY the token is bound to,
 * which is what the capability is actually about, and the interpreter derives
 * the digest.
 */
export type ThumbprintCell = { readonly thumbprintOf: KeyFixture };

export type KeyFixture =
  | "ec-sig"
  | "ec-enc"
  | "ec-sig-cert"
  | "ec-enc-cert"
  | "oct-sig"
  | "oct-enc"
  | "oct-enc-cbc"
  | "oct-enc-gcm128"
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

/**
 * The WIRE-AGNOSTIC names for the same two namespaces — `structured` is `jwt` on
 * JOSE and `cwt` on COSE, `opaque` is `jws` and `cws`. Naming one keeps a row
 * that goes through a raw kit door from pinning itself to a wire, which is the
 * whole point of the inversion; the interpreter resolves the name against the
 * wire the run is on.
 */
export type AgnosticKit = "structured" | "opaque";

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
 * The DEPLOYMENT-WIDE settings the `Aegis` under test is constructed with —
 * `new Aegis(settings)`, the surface a deployment configures once and every call
 * then inherits.
 *
 * It exists because a deployment default and a per-call option are DIFFERENT
 * surfaces answering the same question, and only the per-call one is reachable
 * from a `when` step. A deployment that sets a clock tolerance and has it
 * ignored rejects tokens it configured itself to accept, and no per-call row can
 * see that.
 *
 * ⚠ Narrowed to the settings a row can state as JSON. `amphora` and `logger` are
 * the context's own and are never restated here; the key-policy queries and the
 * encryption defaults are reachable per call and belong in a `when` step.
 */
export type DeploymentGivenStep = {
  step: "deployment";
  settings: Pick<
    AegisSettings,
    "certificateThumbprintSha1" | "clockTolerance" | "dpopMaxSkew" | "partyRecipient"
  >;
};

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
 * The part of a built artifact a {@link TamperGiven} rewrites.
 *
 * The three are the three inputs to the integrity computation, and they are
 * named separately because a caller's mental model of "the token was modified"
 * covers all three while only one of them is the signature itself. RFC 7515
 * §5.2 step 8 fixes the JOSE signing input as
 * `ASCII(BASE64URL(UTF8(JWS Protected Header)) || '.' || BASE64URL(JWS Payload))`,
 * and RFC 9052 §4.4 fixes the COSE one as a `Sig_structure` carrying "The
 * protected attributes from the body structure, encoded in a bstr type" and
 * "The payload to be signed, encoded in a bstr type" — so on both wires the
 * header and the payload are covered by the signature exactly as the signature
 * is, and all three must be refused.
 */
export type TamperSegment = "header" | "payload" | "signature";

/**
 * Modify the artifact AFTER it was built and BEFORE the act — the only way to
 * put a token that was altered in transit in front of a verifier.
 *
 * ⚠ The rewrite is STRUCTURE-PRESERVING on purpose. A `header` or `payload`
 * tamper re-encodes a well-formed header/claims container with one member added,
 * and a `signature` tamper flips a byte of the signature and nothing else — so
 * the token still parses, still names its key, still declares its algorithm, and
 * the refusal is attributable to the integrity check rather than to a decoder
 * giving up on malformed bytes. A row whose token failed to parse would state
 * nothing about signature verification at all.
 */
export type TamperGiven = { segment: TamperSegment };

/**
 * Extra COSE header parameters a FOREIGN producer places in each of the two
 * buckets, stated in the JOSE wire vocabulary (`typ`, `cty`, `oid`, …) and
 * written at the integer label the header registry gives them.
 *
 * ⚠ COSE ONLY, and it exists because aegis's own writers deliberately cannot
 * produce these shapes: a caller `typ` is kit-derived in either bag, and every
 * parameter the registry marks `placement: "protected"` is REFUSED from the
 * unprotected bag. So the only way to state what a reader must do with an
 * unauthenticated `typ`/`cty`/`oid` — ignore it — is to have somebody else write
 * one. A row using this owes the JOSE wire an `unsupported` reason; the
 * interpreter refuses it there rather than signing a token that silently drops
 * half the row.
 *
 * ⚠ `unprotectedHeader` entries are written AFTER the producer's own derived
 * `kid`, which is the routing hint aegis's COSE key resolution reads.
 */
export type CoseBucketsGiven = {
  protectedHeader?: Dict;
  unprotectedHeader?: Dict;
};

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
 * - `foreign`        — a token written by SOMETHING THAT IS NOT AEGIS.
 */
type TokenGivenShape =
  | MintGivenStep
  /**
   * A token written by a FOREIGN producer — `jose` on the JOSE wire,
   * `@auth0/cose` on the COSE wire — over the key the vault already holds, so the
   * signature is real and the only thing under test is what aegis does with the
   * envelope.
   *
   * ⚠ It exists because aegis's own writers cannot express every conformant
   * envelope. Every aegis writer stamps a type header on both wires (a bare JWT
   * gets `JWT`, a bare CWT `application/cwt`), and neither the domain nor the kit
   * options can suppress it — `WireProtectedHeader` Omits `typ` and an empty
   * `tokenType` prefix floors to the bare conventional form. RFC 7519 §5.1 makes
   * the JOSE `typ` OPTIONAL and RFC 9596 §2 makes the COSE one optional too, so a
   * typ-LESS token is conformant, ordinary, and unproducible here. A presence
   * policy stated against tokens that always satisfy it is a policy nothing tests.
   *
   * `typ` is the ONE header parameter this step controls, and it is stated as the
   * FULL header value on either wire (`"at+jwt"`, `"application/at+cwt"`); absent
   * means the producer stamps none. It may be stated PER WIRE, because the two
   * spellings of one media type are different strings (RFC 8392 §9.2 registers
   * `application/cwt` against RFC 7519 §5.1's `JWT`), so a row asserting a typed
   * foreign token on both wires cannot name one value for both.
   *
   * `key` names the vault resident the producer signs with; absent means the
   * baseline `ec-sig` key. A SYMMETRIC key changes the COSE STRUCTURE rather than
   * only the algorithm — RFC 9052 §4.2 defines COSE_Sign1 as carrying a digital
   * signature and §6.2 defines COSE_Mac0 as the MACed structure with an implicit
   * key — so the producer emits a COSE_Mac0 for one, which is the only conformant
   * way a shared secret authenticates a CWT.
   *
   * Everything else — `alg`, `kid` — is derived from the key, because a foreign
   * token that could not be verified at all would observe nothing.
   */
  | {
      step: "token";
      via: "foreign";
      claims: JwtClaimsWire & Dict;
      typ?: string | Partial<Record<Wire, string>>;
      key?: KeyFixture;
      coseBuckets?: CoseBucketsGiven;
    }
  /**
   * The WIRE-AGNOSTIC claims passthrough — the default form, and the one a new
   * row should reach for. Claims are stated in the JOSE spelling and the
   * interpreter re-spells the diverging ones for COSE, so ONE row puts the same
   * shape in front of both verifies.
   *
   * ⚠ The re-spelling is DERIVED FROM THE CLAIM REGISTRY, never hand-listed: the
   * registry is the single source of truth for what a claim is called on each
   * wire, and today it declares exactly one divergence (`jti` on JOSE is `cti` on
   * COSE, RFC 8392 §3.1.7). A hand-copy here would go stale the day a second
   * divergence is registered — and it would go stale SILENTLY, since a claim
   * written under its JOSE name on a COSE wire is not an error, merely an
   * unregistered custom claim, which is precisely the shape several rows here
   * exist to catch.
   */
  | {
      step: "token";
      via: "kit-sign";
      kit: "structured";
      claims: JwtClaimsWire & Dict;
      options?: StructuredSignOptions;
    }
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
  /**
   * The wire-agnostic OPAQUE passthrough — `jws` on JOSE, `cws` on COSE.
   *
   * ⚠ Typed against the NARROWER of the two bags. `cws.sign` takes everything
   * `jws.sign` does plus `omit`, so typing this against the COSE bag let a row
   * name `omit`, have it honoured on COSE and silently dropped on JOSE — the two
   * wires handed different inputs with nothing to say so. A row that needs `omit`
   * is a `cws` row, and owes JOSE an `unsupported` reason.
   */
  | {
      step: "token";
      via: "kit-sign";
      kit: "opaque";
      claims: TokenContent;
      options?: JwsSignOptions;
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
  /** The wire-agnostic SEALING namespace — `jwe` on JOSE, `cwe` on COSE. */
  | {
      step: "token";
      via: "kit-encrypt";
      kit: "sealed";
      data: TokenContent;
      options?: CweSealOptions;
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
 * A token-producing GIVEN, with the optional post-build {@link TamperGiven}.
 *
 * ⚠ DISTRIBUTED over the union rather than intersected with it. `(A | B) & C`
 * is one intersection of a union, and the `never` exhaustiveness checks the
 * interpreter's `switch (artifact.via)` ends in do not reduce it; the
 * distributive conditional below yields a genuine union of intersections, so a
 * new `via` member is still a compile error at every dispatch site.
 */
export type TokenGivenStep = TokenGivenShape extends infer Member
  ? Member & { tamper?: TamperGiven }
  : never;

/**
 * NO token at all: a flat claim dict, for the static `Aegis.assert` /
 * `Aegis.matches` surface.
 */
export type ClaimsGivenStep = { step: "claims"; claims: Dict };

/** The steps that stock the world before the artifact exists. */
export type SetupGivenStep = KeysGivenStep | ClockGivenStep | DeploymentGivenStep;

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
 * A DPoP proof the interpreter SIGNS, at run time, over the token the row just
 * produced — the one artifact a row cannot write down.
 *
 * RFC 9449 §4.2 makes `ath` "hash of the access token" the proof is presented
 * with, so a conformant proof commits to a token that does not exist until the
 * GIVEN has run. A literal proof in the table could only commit to a token no row
 * presents, which is precisely the state `verify` must REFUSE — so a table that
 * could only spell literals could only ever state the refusals, never the
 * acceptance, and the success path of the possession check would go unstated.
 *
 * The proof is produced by the FOREIGN JOSE library, not by aegis, because a
 * presenter is by definition not the verifier.
 */
export type DpopProofGiven = {
  /**
   * The key the proof is signed with, and whose public JWK rides in its header
   * for the verifier to thumbprint (RFC 9449 §4.2 `jwk`).
   */
  key: KeyFixture;
  /**
   * Which access token the proof's `ath` commits to. `presented` is the token
   * under test — the conformant case; `other` is a proof captured against a
   * DIFFERENT access token, which is the replay the claim exists to stop.
   */
  ath?: "presented" | "other";
  /**
   * What the PRESENTER signed — RFC 9449 §4.2 `jti` (the proof's own identifier,
   * which is what makes it single-use) and `htm`/`htu` (the HTTP request it
   * commits to).
   *
   * Stated by the row rather than fixed by the interpreter so that a row
   * asserting these back through a `dpop` THEN states a ROUND TRIP — the
   * verifier reports what the presenter signed — instead of two references to
   * one shared constant, which would agree no matter what the verifier read.
   */
  tokenId: string;
  httpMethod: string;
  httpUri: string;
};

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
  dpopProof?: DpopProofGiven;
};

/** The profile-less verify act — `verify(token, assert, options)`, three positionals. */
export type PlainVerifyStep = {
  step: "verify";
  profile?: undefined;
  assert?: VerifyAssert;
  options?: VerifyOptions;
  /**
   * The proof to present with the token, signed by the interpreter and merged
   * into `options.dpopProof`. Separate from `options` because `VerifyOptions`
   * takes the FINISHED proof as a string and a row cannot hold one.
   */
  dpopProof?: DpopProofGiven;
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
  /**
   * A RAW namespace's own verify door — `aegis.<kit>.verify(...)`.
   *
   * `options` is the kit's own bag, and it is here because the raw door threads
   * it by hand exactly as the domain door does: a knob honoured at one and
   * dropped at the other is invisible to a caller, who sees an option accepted
   * and nothing happen. It is admitted for the STRUCTURED kits only — an opaque
   * token carries no claims layer, so `VerifyUnstructuredTokenOptions` has no
   * temporal knob to state and a row naming one there would be asserting against
   * an option the door does not have.
   */
  | {
      step: "kit-verify";
      kit: SignKit | AgnosticKit;
      options?: VerifyStructuredTokenOptions & { key?: AegisVerifyKey };
    }
  /**
   * The static claim matcher, run through BOTH of its public forms:
   * `Aegis.matches` (the boolean a caller branches on) and `Aegis.assert` (the
   * throwing form a caller gates on), over the same claims, matcher and options.
   * The row states ONE verdict because the two must never disagree — a caller
   * choosing the branching form over the rejecting one is choosing a call
   * convention, not a rule.
   */
  | { step: "static-assert"; assert: DomainAssert; options?: AssertOptions };

/** A row's WHEN: at least one act, run in order; the LAST one's result is asserted. */
export type When = readonly [WhenStep, ...ReadonlyArray<WhenStep>];

// ---------------------------------------------------------------------------
// THEN
// ---------------------------------------------------------------------------

/**
 * The act completed. `format` names the encoding the artifact came back as.
 *
 * A wire-agnostic row reaches a DIFFERENT format on each wire — the same domain
 * scenario is a `jwt` on JOSE and a `cwt` on COSE — so the format may be stated
 * per wire. A bare tag means "this exact format on every wire the row runs on",
 * which is only true of a row pinned to one wire; the interpreter refuses the
 * combination rather than letting a JOSE tag pass vacuously on a COSE run.
 */
export type AcceptsThenStep = {
  step: "accepts";
  format?: TokenFormatTag | Partial<Record<Wire, TokenFormatTag>>;
};

/**
 * The act threw. A rejection is the whole outcome — there is nothing left to
 * observe.
 *
 * `on` scopes the verdict to ONE wire, for the same reason {@link
 * ObservationThenStep.on} exists and under the same restriction: a rejection
 * that differs in SPELLING between the wires is still one rule. Both spellings a
 * refusal has are wire identifiers by construction — the error NAMESPACE and the
 * `format` tag the error carries as data (`jwt` / `cwt`) — so neither can stand
 * for both, and without scoping, one of them would drag the whole capability back
 * onto a single wire and the other wire would silently stop being covered.
 *
 * ⚠ A per-wire pair must name classes at the SAME DEPTH of the error tree, or the
 * two wires are held to different bars rather than to one rule in two spellings.
 * `JwtError` is a LEAF (it extends `JoseError`); `CoseError` is the family ROOT
 * that `CwtError`, `CwsError`, `CweError` and `CwmError` all extend, so pairing
 * the two demands the exact class on JOSE while accepting anything COSE throws.
 * The symmetric pairs are `JwtError`/`CwtError` and `JoseError`/`CoseError`.
 *
 * ⚠ Never for a refusal that differs in SUBSTANCE. A rule that genuinely refuses
 * on one wire only is a one-wire row with an `unsupported` reason.
 *
 * A row states at most one verdict per wire, plus at most one unscoped verdict
 * as the fallback; the interpreter takes the scoped one where the run's wire has
 * it and refuses a wire no verdict covers.
 */
export type RejectsThenStep = {
  step: "rejects";
  on?: Wire;
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
 *
 * ⚠ AT LEAST ONE of the three, enforced by the compiler rather than by a
 * convention: a wire step with all three omitted names a bucket, reads it, and
 * checks nothing — a vacuous pass that reads on the page exactly like coverage
 * of that bucket. The union below is the cheapest way to make it a build error.
 */
export type WireAssertion =
  | {
      includes: Dict;
      present?: ReadonlyArray<WireKey>;
      excludes?: ReadonlyArray<WireKey>;
    }
  | {
      includes?: Dict;
      present: ReadonlyArray<WireKey>;
      excludes?: ReadonlyArray<WireKey>;
    }
  | {
      includes?: Dict;
      present?: ReadonlyArray<WireKey>;
      excludes: ReadonlyArray<WireKey>;
    };

/**
 * The proof claims a row states, typed against the real parsed shape so a
 * misspelled expectation is a compile error rather than a silently absent check.
 */
export type DpopProofExpectation = Pick<
  ParsedDpopProof,
  "tokenId" | "httpMethod" | "httpUri"
>;

type ObservationStep =
  /**
   * The expected DOMAIN claims, typed against the real `DomainClaims` — so a
   * misspelled EXPECTATION (`confirmaton`) is a COMPILE error, not a silent red
   * indistinguishable from the shortfall the row states. The same typo guard the
   * GIVEN side already has, now on the THEN side.
   */
  | {
      step: "claims";
      expected: Partial<DomainClaims>;
      /**
       * The claims that must NOT have reached this bucket. Typed against the
       * WHOLE registered vocabulary rather than `DomainClaims` alone, because
       * the point of an exclusion here is that a claim did not land in the WRONG
       * bucket — a sensitive claim showing up among the ordinary ones is exactly
       * the shape being excluded, and it is not a `DomainClaims` key. A
       * misspelled exclusion excludes nothing while passing, so the name is
       * checked.
       */
      excludes?: ReadonlyArray<keyof RegisteredClaims>;
    }
  /**
   * ⚠ The custom bucket stays OPEN, and must: it IS the unregistered remainder,
   * so there is no closed vocabulary to check a name against. And a
   * domain-LOOKING name legitimately lands here — an `expires_at` arriving as
   * `expiresAt` is exactly that — so a "must not be a domain claim name" guard
   * would reject the very divergence a row would exist to state.
   */
  | { step: "custom"; expected: Dict; excludes?: ReadonlyArray<string> }
  /**
   * A read-side CATEGORY bucket. These have no wire representation at all — a
   * claim travels flat and is categorised on the way in — so the bucket a claim
   * lands in is a statement the result makes and nothing on the wire can
   * confirm. `absent: true` asserts the bucket is not there, which is how a
   * suppression is stated: an EMPTY bucket is truthy, so a consumer writing
   * `if (result.sensitive)` would read one as populated.
   */
  | {
      step: "bucket";
      bucket: "profile" | "sensitive" | "delegation";
      absent: true;
      expected?: undefined;
    }
  | {
      step: "bucket";
      bucket: "profile" | "sensitive" | "delegation";
      absent?: undefined;
      expected: Dict;
    }
  /**
   * The OPAQUE payload — what an artifact carrying no claims layer delivers, and
   * the only place a caller can read it. Stated as the value the payload
   * round-trips to: a `Dict` when the content type negotiated an object, the
   * string itself when it negotiated text.
   *
   * `excludes` names members the payload must NOT carry. An object `expected` is
   * matched as a SUBSET — extra members pass — so a row about something being
   * REMOVED from the sealed value (an empty entry the caller asked to prune) has
   * no way to say so otherwise, and would hold whether or not the removal
   * happened. A string payload is compared whole, so it takes no exclusions.
   */
  | { step: "raw"; expected: Dict; excludes?: ReadonlyArray<string> }
  | { step: "raw"; expected: string; excludes?: undefined }
  /**
   * The UNTRANSLATED wire claims a domain read passes through verbatim, for a
   * caller that must re-emit or forward exactly what arrived. Wire-named by
   * definition, so the bag stays open.
   */
  | { step: "untranslatedClaims"; expected: Dict }
  /**
   * The PARSED DPoP proof a verify reports for a bound token presented with one.
   *
   * The row states the proof's own claims (RFC 9449 §4.2 `jti`/`htm`/`htu`) —
   * they are what a resource server acts on, and reporting them is the whole
   * reason the possession check returns anything at all rather than just not
   * throwing. The two DERIVED facts are asserted by the interpreter on every such
   * row instead, because neither can be written down: the thumbprint is the bound
   * key's digest, and `accessTokenHash` is a hash of the token the row produced.
   * Those two are the check itself — that the proof was made by the key the token
   * names, for the token actually presented — so they are asserted wherever a
   * proof is presented rather than left to a row to remember.
   */
  | { step: "dpop"; expected: DpopProofExpectation }
  /**
   * The token's STRUCTURE, read by the independent inspector: the CBOR tag chain
   * outermost-first on COSE (`[61, 18]` is a CWT-tagged COSE_Sign1), the compact
   * serialisation's part count on JOSE (3 for a JWS/JWT, 5 for a JWE).
   *
   * ⚠ It is the only assertion that distinguishes the COSE structures from each
   * other WITHOUT asking aegis: `format` is aegis reporting what it decided the
   * bytes were, so a writer and a reader that agreed on the wrong tag would
   * report the right format all the way through.
   */
  | { step: "wireStructure"; tags: ReadonlyArray<number>; parts?: undefined }
  | { step: "wireStructure"; parts: number; tags?: undefined }
  /**
   * The expected DOMAIN header fields — the ONE header a domain result reports,
   * typed for the same reason as `claims`.
   *
   * `excludes` names the fields that must NOT have reached it, and that is where
   * the header's provenance rule is stated: the two wire buckets are merged under
   * the header registry's `placement` allowlist, so a parameter declared
   * `"protected"` that arrived UNAUTHENTICATED is dropped and must be excluded
   * here. (There is no domain-tier unprotected bucket to assert on — that split
   * is a COSE structural fact and lives on the KIT results. The raw buckets are
   * asserted with `wireProtectedHeader` / `wireUnprotectedHeader`.)
   */
  | {
      step: "header";
      expected: Partial<DomainTokenHeader>;
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

/**
 * An observation, optionally scoped to ONE wire.
 *
 * `on` exists for the observations that genuinely cannot be stated once: a raw
 * COSE label (`4`) and a raw JOSE claim name (`exp`) are different assertions
 * about the same domain fact, and RFC 9052 §1.5 makes the integer and the text
 * string different labels, so neither spelling can stand for both. Scoping the
 * OBSERVATION is what keeps the ROW wire-agnostic: without it, one raw-label
 * assertion would drag the whole capability back onto a single wire and the
 * other wire would silently stop being covered.
 *
 * ⚠ `on` is for a consequence that differs in SPELLING, never for one that
 * differs in SUBSTANCE. A rule that genuinely holds on one wire only is a
 * one-wire row with an `unsupported` reason — a different statement, and the one
 * that has to be justified.
 */
export type ObservationThenStep = ObservationStep & { on?: Wire };

export type ThenStep = AcceptsThenStep | RejectsThenStep | ObservationThenStep;

/**
 * A row's THEN: the verdict first, then one step per further observable
 * consequence. Compiler-enforced — a rejection admits no observations, because
 * there is no result to observe, and an observation without a verdict would
 * assert against whatever the act happened to leave behind.
 *
 * A rejecting row may state SEVERAL verdicts, but only as the per-wire
 * spellings of the one refusal — see {@link RejectsThenStep.on}. Exactly one of
 * them applies to any given run.
 */
export type Then =
  | readonly [RejectsThenStep, ...ReadonlyArray<RejectsThenStep>]
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
   * terms, for whoever repairs it. DELETE THIS FIELD WHEN THE CELL GOES GREEN;
   * `rationale` is what survives. Present-tense and CHECKED: a table test asserts
   * it is set on exactly the (row, wire) cells that currently fail.
   *
   * ⚠ PER WIRE, or a bare string for a shortfall that manifests on every wire the
   * row runs on. It was a bare string ALONE, which was a row-level field
   * describing a per-wire fact: the invariant is evaluated per cell, so a
   * capability that holds on one wire and not the other reported
   * `"[jose] — PASSES but still carries a knownDefect"` however it was written,
   * and there was no honest way out — `unsupported` is reserved for a
   * SPECIFICATION reason and would be a lie about a wire that works, and
   * splitting into two wire-pinned rows owes the working wire the same lie.
   *
   * The per-wire form is the shape `KnobDefect.wires` already gives the knob
   * table for the identical question, so this is one concept spelled once rather
   * than a convention to remember.
   */
  knownDefect?: string | Partial<Record<Wire, string>>;
  given: Given;
  when: When;
  then: Then;
  /**
   * The wires this capability CANNOT be stated on, each with the reason.
   *
   * ⚠ THIS FIELD IS THE ONLY WAY TO RUN ON FEWER THAN EVERY WIRE. Coverage is
   * the default; a row with no entry here runs on both, and a row that names a
   * wire-specific artifact (a concrete `kit`, a concrete `format`, a raw-label
   * observation) MUST list the other wire here — the table's integrity test
   * fails a row that quietly covers one wire without saying so.
   *
   * The reason is load-bearing prose for a reader, so it states WHY the other
   * wire cannot carry the capability — a specification that defines the
   * parameter on one wire only, a serialisation with no bucket to put it in — and
   * not merely that no row was written. A reason that amounts to "not done yet"
   * is a gap, and a gap belongs in the project's open items, not in a field whose
   * job is to close the question.
   */
  unsupported?: Partial<Record<Wire, string>>;
};

// The deployment identity every row shares — the same one the seed suite uses.
export const ISSUER = "https://test.lindorm.io/";
export const RESOURCE = "https://rs.lindorm.io/";
export const CLIENT = "client-1";

/** The default clock: `2024-01-01T08:00:00.000Z`, in epoch seconds. */
export const NOW = 1704096000;

/**
 * The skew allowance the tolerance rows state, in seconds.
 *
 * Deliberately SMALL and deliberately not a round minute. The rows around it
 * bracket the boundary one second apart — `exp: NOW - CLOCK_TOLERANCE` accepts,
 * `exp: NOW - CLOCK_TOLERANCE - 1` refuses — which is what fixes the allowance
 * as an inclusive WIDTH in seconds. A generous value against a token expired far
 * inside it states only that some window was opened, and every arithmetic error
 * that widens the window (a unit confusion, a scale factor) keeps such a row
 * green.
 */
export const CLOCK_TOLERANCE = 5;

/** A real 32-byte base64url thumbprint (`Buffer.alloc(32, 7)`) — the COSE encoder refuses a short one. */
export const JKT = "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc";

/**
 * Why a JWK-thumbprint confirmation cannot be stated on the COSE wire, said once
 * because every proof-of-possession row that needs a BOUND token owes the same
 * answer and a reason restated by hand drifts a sentence at a time.
 *
 * ⚠ The COSE wire is NOT thumbprint-less — RFC 9679 §5.6 adds `ckt` and §8
 * registers it at Confirmation Key 5, so "COSE has no thumbprint confirmation"
 * would be false. What has no COSE spelling is the JOSE one, and the two are not
 * interchangeable because they hash different canonicalisations of the same key.
 */
export const NO_JKT_ON_COSE =
  "a JWK thumbprint confirmation has no CWT counterpart — RFC 9679 §5.5: \"This document does not register a JWT confirmation method [RFC7800] for using 'ckt' as a confirmation method for a JWT or a CWT confirmation method [RFC8747] for using 'jkt' as a confirmation method for a CWT.\" The COSE wire has a thumbprint confirmation of its own, `ckt` (RFC 9679 §5.6, registered at Confirmation Key 5 in §8), but it is the digest of the key's canonical CBOR whereas RFC 7638 digests its canonical JSON, so the same key yields DIFFERENT bytes and a `jkt` can never be relabelled as its COSE counterpart. A bound token cannot be built on this wire to present in the first place";

/**
 * The id of the ES512 signing key every scenario context is built with — the
 * value a row expects to find in a `kid`. It is the fixture's own id, restated
 * here because a row carries literals and never reads one out of a key object.
 */
export const SIG_KEY_ID = "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7";

/**
 * The other vault residents a row may NAME in a key condition. Same rule as
 * {@link SIG_KEY_ID}: a row carries literals and never reads an id off a key
 * object.
 */
export const OKP_SIG_KEY_ID = "2fa52a91-7f63-5731-a55d-30d36350c642";
export const EC_ENC_KEY_ID = "43bd1720-5dab-5d52-ae1e-e9dbbe6adfe4";
export const OCT_ENC_KEY_ID = "ae26175f-961d-5947-8318-6299e4576b83";
export const OCT_ENC_CBC_KEY_ID = "6f3b8d2a-4c1e-5a90-8b7d-2e5f9c0a1b34";
export const OCT_ENC_GCM128_KEY_ID = "b2d9e4c7-8a15-5f36-9c0b-4d7e2a8f1503";
export const CERT_SIG_KEY_ID = "8e18cf4f-1a3b-5cb1-9a2e-1c9d0a2b3c4d";
export const CERT_ENC_KEY_ID = "0c7a2b61-5d4e-59f0-b3c2-7e6d5f4a3b2c";

/**
 * The two thumbprints of the certificate `ec-sig-cert` carries — the SHA-256 one
 * a binding is checked against (RFC 7515 §4.1.8) and the SHA-1 one that rides
 * along for older clients (§4.1.7). Restated as literals for the same reason as
 * the key ids above: a row carries values, never a computation over a fixture.
 */
export const CERT_THUMBPRINT = "PQeZGdGGGG1A9Qr4z0qBh_TJrmoi5B-6jbMUOGn34QA";
export const CERT_THUMBPRINT_SHA1 = "83RTODK4dhmAaqY7_fQX8atsXG4";

const BACKCHANNEL_LOGOUT = "http://schemas.openid.net/event/backchannel-logout";

const NIN = "19900101-1234";

/**
 * The RAW artifacts a hash claim is derived FROM — an access token, an
 * authorization code, a `state` value. They are the caller's inputs on both
 * sides of the round trip: mint hashes them into `at_hash`/`c_hash`/`s_hash`,
 * and a verify matcher presents the same raw value for the check to re-derive.
 */
const AT_SOURCE =
  "12ceb9251ddf52399fe62f122a45844865a83dcb52585fea90ae3448e0244ab0037950882d705675a4fe248e1c8d9f5c";
const CODE_SOURCE = "999a8b01e27c56aeb5b2f47c001ef8be7be39a375f8c5e929f82df1626de01d8";
const STATE_SOURCE = "7409ac52a9615b8c9f9a";

/**
 * Every claim the registry types as a LIST and the domain matcher surface names.
 * Stated once and asserted as a set, because the containment rule below is one
 * rule over all seven — a per-claim row would state it seven times and still say
 * nothing about the eighth claim added later.
 */
const LIST_CLAIMS = {
  audience: ["a-value"],
  scope: ["a-value"],
  authMethods: ["a-value"],
  roles: ["a-value"],
  permissions: ["a-value"],
  groups: ["a-value"],
  entitlements: ["a-value"],
} as const;

const LIST_CLAIM_MATCHERS = {
  audience: "a-value",
  scope: "a-value",
  authMethods: "a-value",
  roles: "a-value",
  permissions: "a-value",
  groups: "a-value",
  entitlements: "a-value",
} as const;

/** The instant the static temporal rows treat as the claim set's expiry. */
const EXPIRES_AT = "2024-01-01T09:00:00.000Z";

/** {@link NOW} as an ISO-8601 instant, for a row that states a `Date` option. */
const DEFAULT_INSTANT = "2024-01-01T08:00:00.000Z";

/**
 * A wire claims set that verifies cleanly at the table's default clock — the
 * baseline for a row whose subject is something OTHER than the claims.
 */
const LIVE_CLAIMS: JwtClaimsWire & Dict = {
  iss: ISSUER,
  sub: "user-1",
  aud: [RESOURCE],
  exp: NOW + 3600,
  iat: NOW,
  jti: "token-1",
};

export const SCENARIOS: ReadonlyArray<Scenario> = [
  // ---------------------------------------------------------------------------
  // The audience floor.
  // ---------------------------------------------------------------------------
  {
    id: "audience-floor-reads-the-wire-audience-claim",
    title:
      "a token whose wire audience names someone else is refused even when it also carries a custom audience claim",
    rationale:
      "The audience floor is what stops a token minted for one resource being replayed at another: RFC 7519 §4.1.3 requires a verifier that does not identify itself in `aud`, when that claim is present, to reject the token, and RFC 8392 §3.1.3 gives the CWT claim the same meaning and processing rules. Only the registered wire claim states who the issuer meant it for. An unregistered custom claim that merely spells the same word differently carries no such statement, so it must never be able to answer the check on the wire claim's behalf — otherwise the presenter, not the issuer, decides the audience.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
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
      "RFC 7519 §4.1.3 makes `aud` the claim by which an issuer names who a token is for, and RFC 8392 §3.1.3 carries that meaning onto the COSE wire unchanged. A token that omits it names nobody, so a verifier identifying itself cannot be in it. The check therefore has to fail on ABSENCE as well as on mismatch — a rule that only compares the registered claim WHEN PRESENT lets a presenter supply a look-alike of its own and be believed, which hands the audience decision to the party the check exists to constrain.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
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
      "RFC 7519 §4.1.3 — when `aud` is present, a verifier that does not identify itself in it MUST reject the token. RFC 8392 §3.1.3 gives the CWT claim the same meaning and processing rules, so the refusal is owed on either encoding.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
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
      "A token that claims to be bound but is not is strictly worse than a bearer token, because the verifier stops asking for a proof. RFC 9679 §5.5 declines to register \"a CWT confirmation method [RFC8747] for using 'jkt' as a confirmation method for a CWT\", so there is no COSE label a JWK thumbprint may travel under; the COSE thumbprint confirmation that does exist, `ckt` (RFC 9679 §5.6), digests the key's canonical CBOR while RFC 7638 digests its canonical JSON, so the same key yields DIFFERENT bytes and emitting one under the other's label would mislabel the digest and fail against any conformant verifier. A confirmation the wire cannot carry must therefore fail closed at mint rather than be dropped on the way out.",
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
    // The act is the MINT, not a verify: under the fail-closed rule a
    // proof-of-possession CWT is not mintable at all until a real COSE key
    // thumbprint can be derived from the confirmed key, so there is no bound CWT
    // to present to a verifier here.
    when: [{ step: "mint" }],
    // The `data` names the member the refusal READ, so it is attributable to the
    // thumbprint having no COSE form rather than to the confirmation being
    // unusable for some other reason. `keyId` IS representable and is absent
    // from the list, which is what makes this a per-MEMBER refusal rather than
    // the old all-or-nothing one.
    then: [{ step: "rejects", error: "CoseError", data: { members: ["jkt"] } }],
    unsupported: {
      jose: "the JOSE wire CAN carry this confirmation, so there is no refusal to state on it: RFC 9449 §6.1 defines `jkt` as a JWT confirmation-method member for use under `cnf`, whose value is the base64url-encoded SHA-256 JWK thumbprint (RFC 7638) of the key the token is bound to. A mint that refused a `jkt` there would refuse the conformant shape",
    },
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
    // this refusal attributable is the row
    // `a-bound-token-verifies-when-the-caller-vouches-for-the-binding` — the SAME
    // token, the same profile, differing only in `trustBoundThumbprint`, and it
    // verifies.
    then: [{ step: "rejects", error: "AegisDomainError" }],
    unsupported: {
      cose: NO_JKT_ON_COSE,
    },
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
    unsupported: {
      cose: NO_JKT_ON_COSE,
    },
  },
  {
    id: "a-bound-token-verifies-against-a-proof-made-by-the-key-it-names",
    title:
      "a token carrying a confirmation verifies when the presenter proves possession of the confirmed key",
    rationale:
      "RFC 7800 §3 has the issuer declare that the presenter possesses a particular key and that the recipient can cryptographically confirm it, so the floor must be able to say YES and not only NO — a check that can only refuse leaves proof-of-possession unusable and deployments drop the confirmation instead. RFC 9449 §4.3 states the check: 'confirm that the public key to which the access token is bound matches the public key from the DPoP proof'. The proof's own claims must then reach the caller, because the resource server is what acts on them — §4.2 defines `jti` as the proof's unique identifier and `htm`/`htu` as the HTTP method and URI it commits to, and a verifier that swallowed them would leave single-use and request-binding checks with nothing to run on.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "access_token",
        content: {
          subject: "user-1",
          audience: [RESOURCE],
          clientId: CLIENT,
          // The token binds itself to the PRESENTER's key, and that key is
          // deliberately not a vault resident: the verifier learns it from the
          // proof's own `jwk` header (RFC 9449 §4.2) and from nowhere else, so a
          // resolution that reached for the vault would have nothing to find.
          confirmation: {
            thumbprint: { thumbprintOf: "okp-sig" } as unknown as string,
          },
        },
      },
    ],
    when: [
      {
        step: "verify",
        profile: "access_token",
        options: { audience: RESOURCE },
        dpopProof: {
          key: "okp-sig",
          ath: "presented",
          tokenId: "dpop-proof-1",
          httpMethod: "GET",
          httpUri: "https://rs.lindorm.io/resource",
        },
      },
    ],
    then: [
      { step: "accepts", format: "jwt" },
      {
        step: "dpop",
        expected: {
          tokenId: "dpop-proof-1",
          httpMethod: "GET",
          httpUri: "https://rs.lindorm.io/resource",
        },
      },
    ],
    unsupported: {
      cose: NO_JKT_ON_COSE,
    },
  },
  {
    id: "a-proof-committed-to-another-access-token-is-refused",
    title:
      "a token carrying a confirmation refuses a proof that commits to a different access token",
    rationale:
      "RFC 9449 §4.2 defines `ath` as 'the result of a base64url encoding the SHA-256 hash of the ASCII encoding of the associated access token's value', and §4.3 has the verifier 'ensure that the value of the ath claim equals the hash of that access token'. The claim is what stops a proof from being reusable beyond the request it was made for: without it a proof observed against one token would authorise every other token the observer holds, and the possession check would establish possession of the key while establishing nothing about which token it was presented with.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "access_token",
        content: {
          subject: "user-1",
          audience: [RESOURCE],
          clientId: CLIENT,
          confirmation: {
            thumbprint: { thumbprintOf: "okp-sig" } as unknown as string,
          },
        },
      },
    ],
    when: [
      {
        step: "verify",
        profile: "access_token",
        options: { audience: RESOURCE },
        // The SAME key the token names, so the only thing wrong with this proof
        // is which token it commits to.
        dpopProof: {
          key: "okp-sig",
          ath: "other",
          tokenId: "dpop-proof-2",
          httpMethod: "GET",
          httpUri: "https://rs.lindorm.io/resource",
        },
      },
    ],
    // Class only: the refusal carries no `data`, so there is nothing to pin.
    then: [{ step: "rejects", error: "AegisDomainError" }],
    unsupported: {
      cose: NO_JKT_ON_COSE,
    },
  },
  {
    id: "a-proof-made-by-a-key-the-token-does-not-name-is-refused",
    title:
      "a token carrying a confirmation refuses a proof made by a key other than the one it names",
    rationale:
      "RFC 9449 §4.3 has the verifier 'confirm that the public key to which the access token is bound matches the public key from the DPoP proof'. A proof carries its own public key in its header, so a verifier that checked only that the proof was internally consistent would accept one that any holder of the token could mint for themselves, and the binding would assert nothing at all.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "access_token",
        content: {
          subject: "user-1",
          audience: [RESOURCE],
          clientId: CLIENT,
          confirmation: {
            thumbprint: { thumbprintOf: "okp-sig" } as unknown as string,
          },
        },
      },
    ],
    when: [
      {
        step: "verify",
        profile: "access_token",
        options: { audience: RESOURCE },
        // A conformant proof in every respect except the key it was made with,
        // so the refusal is attributable to the binding and to nothing else.
        dpopProof: {
          key: "rsa-sig",
          ath: "presented",
          tokenId: "dpop-proof-3",
          httpMethod: "GET",
          httpUri: "https://rs.lindorm.io/resource",
        },
      },
    ],
    then: [{ step: "rejects", error: "AegisDomainError" }],
    unsupported: {
      cose: NO_JKT_ON_COSE,
    },
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
      // BOTH recipient keys: JOSE seals with the ECDH-ES key, and COSE_Encrypt0
      // is DIRECT encryption (RFC 9052 §5.2) — the recipient key IS the content
      // encryption key — so an agreement key has no form on that wire and the
      // COSE run needs the symmetric one.
      { step: "keys", keys: ["ec-enc", "oct-enc"] },
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
    // reachable-cleartext half is stated by
    // `claims-container-content-is-published-in-cleartext`.
    then: [{ step: "accepts", format: { jose: "jwe", cose: "cwe" } }],
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
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      // The NON-sensitive neighbour rides the same container, so its presence is
      // what shows the claim was removed for what it IS and not because the
      // container was discarded wholesale.
      //
      // Read through the INDEPENDENT inspector, and stated ONCE for both wires:
      // a claim with no registered CWT label rides COSE under its registered
      // string name, because the registry's compact private-use integer labels
      // are emitted only in `proprietary` mode and mint is interoperable by
      // default. So the spelling here is the same on either wire.
      {
        step: "wireClaims",
        includes: { nickname: "nick" },
        excludes: ["national_identity_number"],
      },
    ],
  },
  {
    id: "claims-container-content-is-published-in-cleartext",
    title:
      "a claim supplied through the claims container is published on the cleartext wire",
    rationale:
      "The `claims` container is the caller's route for additional NON-confidential claims: its content is spread onto the domain layer verbatim and published for the audience to read. Stating where the cleartext boundary sits is what makes any movement of that boundary visible rather than silent.",
    given: [
      // No `keys` step. This row never encrypts — the claim it carries is
      // unregistered, so nothing marks the content sensitive and the confidentiality
      // gate never fires — and a recipient key stocked here would be INERT, reading
      // as a precondition of a capability that has none.
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
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
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
      // BOTH recipient keys: JOSE seals with the ECDH-ES key, and COSE_Encrypt0
      // is DIRECT encryption (RFC 9052 §5.2) — the recipient key IS the content
      // encryption key — so an agreement key has no form on that wire and the
      // COSE run needs the symmetric one.
      { step: "keys", keys: ["ec-enc", "oct-enc"] },
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
    then: [{ step: "accepts", format: { jose: "jwe", cose: "cwe" } }],
  },

  // ---------------------------------------------------------------------------
  // Critical header parameters.
  // ---------------------------------------------------------------------------
  {
    id: "an-unrecognised-critical-parameter-is-refused",
    title: "a token marking an unrecognised header parameter critical is refused",
    rationale:
      "RFC 7515 §4.1.11 — if any of the extension header parameters listed in `crit` are not understood and supported by the recipient, the JWS is invalid. RFC 9052 §3.1 states the COSE half in the same terms: `crit` indicates which protected header parameters a processor of the message is REQUIRED to understand, and refusing the message is the only way to honour that for one it does not. aegis implements no crit extension, so every parameter a producer marks critical is by definition unrecognised — and an enforcement present on one wire but absent on the other means the same hostile token is refused or accepted depending only on its encoding, which is a choice the attacker makes.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
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
    // that branch — and it is the SAME `data` on both wires, which is the point:
    // ONE enforcement serves both. Reaching that branch on the COSE wire
    // required settling what a COSE crit MEMBER is — RFC 9052 §1.5 makes it a
    // label, so the writer emits the integer label the parameter is keyed under
    // and the reader translates it back to the JOSE name the enforcement reads.
    //
    // Only the error NAMESPACE differs, and it is a wire identifier by
    // construction, so it is stated per wire rather than widened to the parent
    // both share. The two are at the SAME DEPTH of the error tree — `CwtError` is
    // the leaf `JwtError`'s counterpart, not `CoseError`, which is the family root
    // and would accept any COSE refusal whatsoever.
    then: [
      { step: "rejects", on: "jose", error: "JwtError", data: { param: "oid" } },
      { step: "rejects", on: "cose", error: "CwtError", data: { param: "oid" } },
    ],
  },

  // ---------------------------------------------------------------------------
  // Token lifetime.
  // ---------------------------------------------------------------------------
  {
    id: "expiry-presence-cannot-be-satisfied-by-a-look-alike-claim",
    title:
      "a token with no exp is refused by the profile floor even when it carries a custom expires_at claim",
    rationale:
      "RFC 7519 §4.1.4 and RFC 8392 §3.1.4 — expiry is stated by the registered `exp` claim and by nothing else. A presence check that an unregistered claim can satisfy merely by resembling the registered one lets a producer hand out a token with no enforceable lifetime, which the verifier then honours indefinitely.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          iat: NOW,
          jti: "token-1",
          client_id: CLIENT,
          expires_at: 978307200,
        },
        options: { tokenType: "at" },
      },
    ],
    when: [{ step: "verify", profile: "access_token", options: { audience: RESOURCE } }],
    then: [{ step: "rejects", error: "AegisDomainError" }],
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
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          iat: NOW,
          jti: "token-1",
          client_id: CLIENT,
        },
        options: { tokenType: "at" },
      },
    ],
    when: [{ step: "verify", profile: "access_token", options: { audience: RESOURCE } }],
    // No `data`: the error carries an EMPTY one, and `toMatchObject({})` is
    // satisfied by anything.
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },

  // ---------------------------------------------------------------------------
  // The verified domain header.
  //
  // The other half of this capability — a `typ` the signature does not cover —
  // cannot be expressed as a row, because its input is unmintable, and lives in
  // `src/internal/cose/unprotected-typ.test.ts#COSE typ integrity`. This half
  // CAN: an `oid` in the
  // protected header is mintable through the public surface, reaches the wire,
  // and is then dropped on the way to the domain header.
  // ---------------------------------------------------------------------------
  {
    id: "protected-header-parameters-reach-the-verified-header",
    title:
      "a token's integrity-protected object identifier reaches the verified domain header",
    rationale:
      "The verified domain header is what a caller inspects to route, audit and police a token, so every parameter the signature covers has to reach it. A protected parameter dropped on the way out is a statement the issuer signed and the consuming code can never see — and what a caller can see of a token must not depend on the encoding the issuer chose for it.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
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
    // The token carries NO `crit`, which is what keeps this row independent of
    // critical-parameter enforcement: it is mintable and verifiable today and
    // stays so under every repair listed in this table.
    //
    // The domain name is reached the same way on both wires: `parseTokenHeader`
    // runs a data-driven pass over the WHOLE decoded wire header, so a
    // private-use parameter resolves through the header registry whichever
    // spelling it arrived under.
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
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
      'OIDC Core makes `at_hash` REQUIRED exactly where an access token is co-issued from the authorization endpoint \u2014 \u00a73.2.2.10 for the implicit flow and \u00a73.3.2.11 for the hybrid flow both read "If the ID Token is issued from the Authorization Endpoint with an access_token value \u2026 this is REQUIRED". (\u00a73.1.3.6, which defines the claim, marks it OPTIONAL; the requirement lives with the flows.) aegis applies the same rule wherever an access token co-issues. Whether one did is a fact only the issuer holds \u2014 it is not in the claims, and nothing about the token distinguishes "no access token was issued" from "the issuer forgot to say". Treating the unstated case as `false` therefore silently issues the exact token the rule exists to prevent, so the fact must be supplied rather than assumed.',
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
        kit: "structured",
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
        kit: "structured",
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
    then: [{ step: "accepts", format: { jose: "jwt", cose: "cwt" } }],
  },

  // ---------------------------------------------------------------------------
  // Caller-supplied key policy.
  // ---------------------------------------------------------------------------
  {
    id: "verify-honours-a-caller-supplied-key-policy",
    title: "a caller-supplied key policy is applied when verifying an opaque signature",
    rationale:
      "A key policy is the caller's constraint on which key material may verify a token — an algorithm floor is how a deployment refuses an algorithm downgrade. A policy silently dropped on one code path is worse than no policy at all, because the caller believes the constraint is in force and stops checking; and a policy that holds on one wire and not the other is a policy an attacker chooses to be bound by, since the encoding is the issuer's choice and the presenter's opportunity.",
    given: [
      { step: "token", via: "kit-sign", kit: "opaque", claims: { hello: "world" } },
    ],
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
        kit: "structured",
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
    when: [{ step: "kit-verify", kit: "structured" }],
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
        kit: "structured",
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
    title: "a domain refusal names the encoding of the token it refused in its data",
    rationale:
      "A domain rule is one rule, so it raises ONE code on both encodings; but a consumer handling that refusal — logging it, rendering it, deciding whether to retry against a different endpoint — still has to know which encoding the refused token was in. That fact therefore has to travel as DATA on the error, because it is no longer in the code. This is aegis policy, not a specification requirement: no RFC says anything about the shape of an implementation's error. What makes it a rule worth pinning is the alternative it replaced — the wire baked into the code as a prefix, one spelling per encoding for a single rule, which forced every consumer to match two codes for one condition and reported a CWT's failure under a name that said JWT. A refusal that names the WRONG encoding is worse than one that names none: it sends whoever reads it to the wrong decoder, the wrong issuer and the wrong half of the code, and it does so most convincingly when both wires share the one implementation that produced it.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
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
    // The refused encoding is the whole subject of the row, so the pin is the
    // one thing that cannot be shared between the wires — each run demands its
    // OWN tag, and a run answered with the other wire's tag fails.
    then: [
      { step: "rejects", on: "jose", error: "AegisDomainError", data: { format: "jwt" } },
      { step: "rejects", on: "cose", error: "AegisDomainError", data: { format: "cwt" } },
    ],
  },

  // ---------------------------------------------------------------------------
  // Header provenance — what the signature covers, and what it does not.
  // ---------------------------------------------------------------------------
  {
    id: "an-unprotected-routing-hint-reaches-the-domain-header",
    title:
      "a CWT's unprotected key identifier reaches the one header the domain result reports",
    rationale:
      "RFC 9052 §3 gives a COSE object two header buckets, and §3.1 puts the `kid` hint in the unprotected one — it 'is not a security-critical field. For this reason, it can be placed in the unprotected-header-parameters bucket'. A caller reading a verified token must still be told which key identifier the token carried, and must be told it the same way on both wires: JOSE compact serialisation has no second bucket (RFC 7515 §7.1), so a domain surface that reported the COSE `kid` under a bucket name of its own would make the same fact unreadable in one place on one wire and another place on the other. `kid` is on the SHORT list of parameters the header registry permits to travel unauthenticated, which is what makes admitting it safe: it names a key, and the key is then proven by the signature rather than believed.",
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
    // result would prove that SOME `kid` was reported — not that the token
    // carried it in the unprotected bucket, which is the whole premise: read
    // through aegis's own decoder, a `kid` the kit had moved into the protected
    // bucket would look identical.
    then: [
      { step: "accepts", format: "cwt" },
      { step: "header", expected: { algorithm: "ES512", keyId: SIG_KEY_ID } },
      { step: "wireProtectedHeader", present: [1, 16], excludes: [4] },
      { step: "wireUnprotectedHeader", present: [4], excludes: [1, 16] },
    ],
    unsupported: {
      jose: "JOSE compact serialisation has no unprotected bucket at all (RFC 7515 §7.1), so no parameter can arrive from one and the merge this row exercises has nothing to merge",
    },
  },
  {
    id: "a-wire-with-no-unprotected-bucket-signs-every-parameter-it-carries",
    title: "every parameter in a JWT's domain header is one the signature covers",
    rationale:
      "RFC 7515 §7.1 — 'Only one signature/MAC is supported by the JWS Compact Serialization and it provides no syntax to represent a JWS Unprotected Header value.' A JWT therefore has exactly one header and the signature covers all of it, so the domain header's provenance question is settled by the serialisation itself: there is no second bucket for an unauthenticated parameter to arrive from. This is what makes ONE domain header the honest shape on this wire — a second, permanently empty bucket beside it would invite a reader to ask which of the two a value came from when the wire admits only one answer.",
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
      // THE SAME PARAMETER SET ON BOTH SIDES — that is the row. Every parameter
      // the DOMAIN header reports is one the raw PROTECTED header carries, so
      // nothing in the domain view arrived from outside the signature. Each half
      // alone is weaker: the domain assertion would be satisfied by a reader that
      // fabricated the values, and the wire assertion would not say what a caller
      // is actually handed.
      {
        step: "header",
        expected: { algorithm: "ES512", keyId: SIG_KEY_ID, headerType: "JWT" },
      },
      { step: "wireProtectedHeader", present: ["alg", "kid", "typ"] },
      // …and there is no second place any of them could have come from, read by
      // the INDEPENDENT inspector: a THREE-part compact serialisation, which is
      // the falsifiable form of RFC 7515 §7.1 — a serialisation that grew a
      // bucket would not be three parts.
      { step: "wireStructure", parts: 3 },
      // The inspector's own answer for this wire. ⚠ A STATEMENT, not a check: a
      // JOSE compact token has no unprotected bucket for the inspector to report,
      // so this can only fail if the inspector begins fabricating one. The three
      // assertions above are what carry the row.
      { step: "wireUnprotectedHeader", absent: true },
    ],
    unsupported: {
      cose: "a COSE structure always carries an unprotected bucket (RFC 9052 §3), so the serialisation-level absence this row asserts cannot arise on that wire",
    },
  },
  {
    id: "a-parameter-that-must-be-signed-is-refused-from-the-unprotected-bucket",
    title:
      "placing a header parameter that must be signed in the unauthenticated bucket is refused",
    rationale:
      "aegis decides which bucket a header parameter travels in — a caller states the parameter, not its provenance — and the decision is the header registry's `placement` column, the SAME datum the read side filters an incoming unprotected bucket by. Enforcing it on write is what makes the two halves one rule: if a writer could emit `cty` unprotected while every reader ignored it there, aegis would issue tokens carrying a declaration nothing will ever read, and the caller would believe a statement had been made. Refusing at the call site names the mistake where it is made, and the value the caller wanted has a bucket that works — the protected one.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: { iss: ISSUER, sub: "user-1", exp: NOW + 3600 },
        // `cty` is caller-settable and NOT kit-derived, so the refusal can only
        // be the placement rule: a reserved parameter would be refused by the
        // reserved rule instead and the row would prove that one twice.
        options: { unprotected: { cty: "application/example" } },
      },
    ],
    when: [{ step: "mint" }],
    then: [{ step: "rejects", error: "CoseError" }],
    unsupported: {
      jose: "the JOSE compact serialisation has no unprotected bucket to refuse a parameter from (RFC 7515 §7.1) — the JOSE kits take the bag only so one option type serves both wires, and ignore it entirely",
    },
  },
  {
    id: "an-unauthenticated-parameter-cannot-restate-a-signed-one",
    title:
      "a parameter stated in both header buckets is reported as the issuer signed it",
    rationale:
      "RFC 9052 §3 covers the protected bucket with the signature and leaves the unprotected one uncovered, so where BOTH state the same parameter only one of the two values has an author a verifier can name. The signed value must therefore win, unconditionally and in that direction: resolving the other way — or by which bucket happens to be read first — would let whoever last held the token overwrite a statement its issuer signed, which is the whole property the protected bucket exists to provide.",
    given: [
      // A FOREIGN producer, because no aegis writer emits this shape: `kid` is
      // kit-derived, so `buildCoseHeaders` refuses a caller value for it in
      // either bag. A token that states one in both is what somebody else emits
      // — or what a holder rewrites the unprotected half of in transit.
      {
        step: "token",
        via: "foreign",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
        },
        coseBuckets: { protectedHeader: { kid: "key_the_issuer_signed" } },
      },
    ],
    when: [{ step: "verify" }],
    then: [
      { step: "accepts", format: "cwt" },
      // ⚠ The token VERIFIES, and that is what makes the row about the merge and
      // not about key resolution: RFC 9052 §3.1 makes `kid` a routing hint, so
      // aegis finds the key by the UNPROTECTED one (the real fixture id) and the
      // signature then proves the key. What the result REPORTS is the signed
      // value — a different question, and the one this row states.
      { step: "header", expected: { keyId: "key_the_issuer_signed" } },
      { step: "wireProtectedHeader", includes: { "4": "key_the_issuer_signed" } },
      { step: "wireUnprotectedHeader", present: [4] },
    ],
    unsupported: {
      jose: "JOSE compact serialisation has one header and no second bucket to restate a parameter from (RFC 7515 §7.1), so the collision this row resolves cannot be constructed on that wire",
    },
  },
  {
    id: "an-unauthenticated-parameter-a-verifier-decides-by-is-ignored",
    title:
      "header parameters that must be signed are ignored when they arrive unauthenticated",
    rationale:
      "A parameter a verifier routes, audits or polices a token by is only worth reading if the issuer said it. RFC 9052 §3.1 permits `kid` in the unprotected bucket precisely because it 'is not a security-critical field' — the rest are not so permitted, and a reader that surfaced them anyway would let whoever last held the token declare what the token IS: its type (RFC 9596 §2 makes `typ` the routing declaration for a whole COSE object), the type of its payload, the certificate it is attributable to, or an object identifier an application authorises against. aegis therefore keeps ONE allowlist for both directions — the header registry's `placement` column — and a parameter outside it is refused on write and ignored on read, so the two can never disagree about which values are trustworthy.",
    given: [
      // Hand-placed by a FOREIGN producer at the very labels aegis reads: this
      // shape is unmintable here precisely BECAUSE of the rule under test, so
      // the injection has to come from somewhere else. Each value is a lie a
      // holder would want believed.
      {
        step: "token",
        via: "foreign",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
        },
        coseBuckets: {
          unprotectedHeader: {
            typ: "application/at+cwt",
            cty: "application/json",
            oid: "1.2.3.4",
            x5u: "https://attacker.lindorm.test/certs.pem",
            x5c: ["MIIBforged"],
          },
        },
      },
    ],
    when: [{ step: "verify" }],
    then: [
      { step: "accepts", format: "cwt" },
      // Every injected parameter is absent from the domain header. ⚠ Two shapes,
      // because the header has two: a registry-driven parameter that never
      // arrived is not a key at all (`excludes`), while `tokenType` is DERIVED —
      // the reader always states an answer for it, and the answer an unsigned
      // `typ` must buy is `undefined`, which is the routing decision this whole
      // rule exists to deny.
      {
        step: "header",
        expected: { algorithm: "ES512", keyId: SIG_KEY_ID, tokenType: undefined },
        excludes: [
          "headerType",
          "contentType",
          "objectId",
          "certificateUrl",
          "certificateChain",
        ],
      },
      // The load-bearing half: the parameters ARE on the wire, at the labels the
      // reader looks at, read back by the independent inspector. Without it the
      // row could pass because the producer never wrote them.
      {
        step: "wireUnprotectedHeader",
        present: [16, 3, -70000, 35, 33],
      },
    ],
    unsupported: {
      jose: "JOSE compact serialisation has no unprotected bucket (RFC 7515 §7.1), so no parameter can arrive unauthenticated on that wire and there is nothing for a placement rule to ignore",
    },
  },

  // ---------------------------------------------------------------------------
  // The asserted token type.
  // ---------------------------------------------------------------------------
  {
    id: "an-asserted-token-type-is-compared-as-a-whole-media-type",
    title: "a token of another type is refused when the caller asserts an id token",
    rationale:
      "RFC 7519 §5.1 — the `typ` header parameter 'is used by JWT applications to declare the media type of this complete JWT', so a caller asserting a token IS of a given type is asserting on that whole media type. The comparison has to be made on the whole of it: a type whose media type is the bare conventional form — an id token is a plain `JWT` — has no structured prefix, so a check that compares prefixes has nothing to compare for exactly that type and silently accepts every token instead. An assertion that cannot fail is worse than an absent one, because the caller has stopped checking. RFC 9596 §2 gives COSE the same parameter — `typ`, registered as label 16 by §4.1, declares 'the type of this complete COSE object', and an application 'might verify that the typ value is a particular application-chosen media type and reject the data structure if it is not' — so the caller's assertion means the same thing on that wire and must be enforced just as hard. An assertion honoured on one encoding and skipped on the other is an assertion the attacker chooses to be bound by, since the encoding is the issuer's choice and the presenter's opportunity.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
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
    // have to satisfy. Both pinned values are the wire's own spelling of the one
    // media type — `application/at+jwt` against `application/at+cwt` — so each
    // run demands its own and a run answered with the other wire's fails.
    then: [
      {
        step: "rejects",
        on: "jose",
        error: "AegisDomainError",
        data: { typ: "application/at+jwt", format: "jwt" },
      },
      {
        step: "rejects",
        on: "cose",
        error: "AegisDomainError",
        data: { typ: "application/at+cwt", format: "cwt" },
      },
    ],
  },
  {
    id: "a-token-of-the-asserted-type-verifies",
    title: "a token typed as an id token verifies when the caller asserts an id token",
    rationale:
      "The type assertion must refuse exactly the tokens of another type and no others. An id token's media type is the bare conventional `JWT` (RFC 7519 §5.1 recommends that spelling and there is no registered structured form for it), so a comparison that got this wrong in the other direction — demanding a structured media type an id token never carries — would refuse every conformant id token in existence. That bare media type has one COSE equivalent, `application/cwt`, registered by RFC 8392 §9.2, so the assertion must accept exactly that and no other there. Getting the accepting half wrong is how a type check is discovered to be too strict only in production, by a deployment whose tokens were conformant all along.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
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
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      // Read off the raw bytes: the media type the assertion matched is the one
      // the token actually carries, not the one aegis reconstructs on the way
      // out. Scoped per wire because the two are the same fact in each wire's own
      // vocabulary — the JOSE parameter NAME `typ` against the COSE integer
      // LABEL 16 (RFC 9596 §4.1), which RFC 9052 §1.5 keeps distinct from the
      // text label "16".
      { step: "wireProtectedHeader", on: "jose", includes: { typ: "JWT" } },
      { step: "wireProtectedHeader", on: "cose", includes: { 16: "application/cwt" } },
    ],
  },

  // ---------------------------------------------------------------------------
  // The domain round trip — what a caller states and what the audience reads.
  // ---------------------------------------------------------------------------
  {
    id: "a-minted-token-round-trips-through-the-domain-verify",
    title:
      "a minted token is read back by the domain verify in the vocabulary it was stated in",
    rationale:
      "The domain surface exists so a caller states claims once, in one vocabulary, and the audience reads the same statement back. Every claim on that path is translated to a wire name on the way out and resolved back on the way in, so a claim lost, renamed or mis-bucketed between the two is a statement the issuer believes it made and nobody receives — and the encoding the issuer chose must not change what the audience can read, because the choice is the issuer's and the consequence is the audience's.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "access_token",
        content: {
          subject: "user-1",
          audience: [RESOURCE],
          clientId: CLIENT,
          scope: ["read", "write"],
        },
      },
    ],
    when: [
      { step: "mint" },
      { step: "verify", profile: "access_token", options: { audience: RESOURCE } },
    ],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      {
        step: "claims",
        expected: {
          subject: "user-1",
          audience: [RESOURCE],
          clientId: CLIENT,
          scope: ["read", "write"],
          issuer: ISSUER,
        },
      },
      // The STRUCTURE, read independently: a claims-bearing artifact is a
      // 3-part compact serialisation on JOSE and a CWT-tagged COSE_Sign1 on
      // COSE. Without it the row would be aegis reporting the format it decided
      // the bytes were, which a writer and a reader that agreed on the wrong
      // structure would also report correctly.
      { step: "wireStructure", on: "jose", parts: 3 },
      { step: "wireStructure", on: "cose", tags: [61, 18] },
    ],
  },
  {
    id: "a-verified-result-carries-the-untranslated-wire-claims",
    title: "a verified token carries the claims exactly as they arrived on the wire",
    rationale:
      "A consumer that forwards, re-emits or logs a token must be able to reproduce what it received, and the domain claim buckets cannot answer that: they are the result of a translation that renames claims, splits them across buckets and decodes their values. The untranslated payload is the only place the exact received statement survives, so a result that omits it forces every such consumer to decode the token a second time — with a second decoder, which is where the two disagree.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "default",
        content: { subject: "user-1", expires: "1h", tokenType: "test_token" },
      },
    ],
    when: [{ step: "mint" }, { step: "verify" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      { step: "untranslatedClaims", expected: { sub: "user-1", iss: ISSUER } },
    ],
  },

  // ---------------------------------------------------------------------------
  // The MAC-authenticated claims structure.
  // ---------------------------------------------------------------------------
  {
    id: "a-symmetric-signing-key-produces-a-mac-authenticated-claims-token",
    title:
      "a claims token keyed with a shared secret is MAC-authenticated and verifies as one",
    rationale:
      "RFC 9052 §6.2 defines COSE_Mac0 as the MACed structure with an implicit key, and §4.2 defines COSE_Sign1 as the structure signed by one signer; they are different objects with different tags and different security properties. A shared secret can only produce the first, so an encoder handed one must emit a COSE_Mac0 and the reader must report it as the MAC-authenticated form — a token whose structure says MAC while the result says signature would let a verifier believe a shared secret proved who issued it.",
    given: [
      { step: "keys", keys: ["oct-sig"] },
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: { subject: "user-1", audience: [CLIENT] },
        options: {
          context: { accessTokenIssued: false },
          format: "cwm",
          // The vault also holds the baseline ES512 key, and a COSE_Mac0 refuses
          // an asymmetric one. The selector pins the class rather than leaving
          // the resolution to whichever resident the query returns first.
          sign: { key: { condition: { algClass: "symmetric" } } },
        },
      },
    ],
    when: [
      { step: "mint" },
      { step: "verify", profile: "id_token", options: { audience: CLIENT } },
    ],
    then: [
      { step: "accepts", format: "cwm" },
      { step: "claims", expected: { subject: "user-1", issuer: ISSUER } },
      { step: "header", expected: { algorithm: "HS256" } },
      // Tag 17 is COSE_Mac0 and tag 18 is COSE_Sign1 (RFC 9052 §2 Table 1). The
      // independent read is what distinguishes them — `format` is aegis
      // reporting its own decision about the same bytes.
      { step: "wireStructure", tags: [61, 17] },
    ],
    unsupported: {
      jose: "JOSE has no separate MAC structure to report. RFC 7515 §1 defines JWS as representing content secured with digital signatures OR Message Authentication Codes — one structure for both — so a MAC-authenticated JOSE claims token is a JWS carrying an HMAC `alg` and reports as a `jwt`. There is no distinct format for the read side to name",
    },
  },
  {
    id: "a-mac-authenticated-claims-token-is-read-keylessly-like-any-other",
    title:
      "the keyless claims read handles the MAC-authenticated structure as well as the signed one",
    rationale:
      "The keyless read exists so a holder can see what a token says before deciding what to do with it — which key to fetch, which issuer to ask, whether to bother at all. That decision has to be available for every claims-bearing structure, or a deployment using the MAC-authenticated form is forced to verify first and inspect afterwards, which is exactly backwards: verification needs the very facts the read would have supplied.",
    given: [
      { step: "keys", keys: ["oct-sig"] },
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: { subject: "user-1", audience: [CLIENT] },
        options: {
          context: { accessTokenIssued: false },
          format: "cwm",
          sign: { key: { condition: { algClass: "symmetric" } } },
        },
      },
    ],
    when: [{ step: "mint" }, { step: "parse" }],
    then: [
      { step: "accepts", format: "cwm" },
      { step: "claims", expected: { subject: "user-1", issuer: ISSUER } },
    ],
    unsupported: {
      jose: "JOSE has no separate MAC structure to read. RFC 7515 §1 defines JWS as representing content secured with digital signatures OR Message Authentication Codes, so a MAC-authenticated JOSE claims token is a `jwt` and is already covered by the ordinary keyless read",
    },
  },
  {
    id: "a-signature-structure-refuses-a-symmetric-key",
    title:
      "a mint asked for the signature structure refuses a shared secret rather than emitting one",
    rationale:
      "RFC 9052 §4.2 defines COSE_Sign1 as the structure signed by one signer, carrying a digital signature, whose whole property is that only the holder of the private key could have produced it. A shared secret has no such property — every party that can verify can also forge — so a structure that admitted one would make a signature and a MAC indistinguishable to the reader, which is the confusion the two separate structures exist to prevent. The refusal has to happen at issue: a token cannot be un-issued.",
    given: [
      { step: "keys", keys: ["oct-sig"] },
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: { subject: "user-1", audience: [CLIENT] },
        options: {
          context: { accessTokenIssued: false },
          format: "cwt",
          // `id_token` declares no algorithm-class floor, so the selector is
          // what puts the shared secret in front of the signature structure.
          sign: { key: { condition: { algClass: "symmetric" } } },
        },
      },
    ],
    when: [{ step: "mint" }],
    then: [{ step: "rejects", error: "CwtError" }],
    unsupported: {
      jose: "JOSE draws no such line to enforce. RFC 7515 §1 defines one structure for both digital signatures and MACs, so an HMAC `alg` is a conformant JWS and a mint that refused it would refuse the conformant shape",
    },
  },

  // ---------------------------------------------------------------------------
  // Integrity of an artifact that was altered after it was issued.
  //
  // Every row here builds a real token, rewrites ONE part of it, and presents
  // the result. The rewrite is structure-preserving (see `TamperGiven`), so the
  // token still parses and still names its key — which is what makes the refusal
  // attributable to the integrity check rather than to a decoder giving up.
  // ---------------------------------------------------------------------------
  {
    id: "a-token-whose-signature-was-replaced-is-refused",
    title: "a token presented with a signature that is not the issuer's is refused",
    rationale:
      'The signature is the only thing that says who issued a token, so a verifier that accepted one it could not validate would be accepting the presenter\'s word for every claim. RFC 7515 §5.2 makes the check and its consequence explicit: step 8 is to "Validate the JWS Signature against the JWS Signing Input", and step 10 — "If none of the validations in step 9 succeeded, then the JWS MUST be considered invalid." RFC 9052 §4.4 gives COSE_Sign1 the same shape through its `Sig_structure`.',
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: LIVE_CLAIMS,
        tamper: { segment: "signature" },
      },
    ],
    when: [{ step: "kit-verify", kit: "structured" }],
    then: [
      { step: "rejects", on: "jose", error: "JoseError" },
      { step: "rejects", on: "cose", error: "CoseError" },
    ],
  },
  {
    id: "waiving-the-expiry-range-check-does-not-waive-signature-verification",
    title:
      "a token whose signature does not validate is refused even when the caller waived the expiry range check",
    rationale:
      "A temporal waiver states one thing — that this caller does not care when the token expires — and it must not be readable as a general instruction to trust the token less carefully. Authenticity and lifetime are independent properties: RFC 7515 §5.2 step 10 makes an unvalidated signature fatal regardless of what the payload says, while RFC 7519 §4.1.4 makes `exp` a claim ABOUT the payload. A waiver that leaked across the two would turn the id_token_hint flow, whose whole purpose is to accept an expired token on the strength of its signature, into a flow that accepts anything.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: { ...LIVE_CLAIMS, exp: NOW - 3600, iat: NOW - 7200 },
        tamper: { segment: "signature" },
      },
    ],
    when: [{ step: "verify", options: { verifyExpiration: false } }],
    then: [
      { step: "rejects", on: "jose", error: "JoseError" },
      { step: "rejects", on: "cose", error: "CoseError" },
    ],
  },
  {
    id: "a-token-whose-payload-was-altered-after-signing-is-refused",
    title: "a token whose claims were rewritten after it was issued is refused",
    rationale:
      "A verifier's guarantee is that the claims it reads are the claims the issuer wrote, and that guarantee comes from the payload being covered by the integrity computation rather than merely travelling beside it. RFC 7515 §5.2 step 8 fixes the JOSE signing input as `ASCII(BASE64URL(UTF8(JWS Protected Header)) || '.' || BASE64URL(JWS Payload))`, and RFC 9052 §4.4 lists \"The payload to be signed, encoded in a bstr type\" among the fields of the `Sig_structure`. A payload outside that computation would let any holder grant itself a scope.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: LIVE_CLAIMS,
        tamper: { segment: "payload" },
      },
    ],
    when: [{ step: "kit-verify", kit: "structured" }],
    then: [
      { step: "rejects", on: "jose", error: "JoseError" },
      { step: "rejects", on: "cose", error: "CoseError" },
    ],
  },
  {
    id: "a-token-whose-protected-header-was-altered-after-signing-is-refused",
    title: "a token whose protected header was rewritten after it was issued is refused",
    rationale:
      'The protected header is where a token states its algorithm, its key and its type, so a header a holder could edit would let the holder restate every one of them. RFC 7515 §5.2 step 8 puts `BASE64URL(UTF8(JWS Protected Header))` inside the JOSE signing input, and RFC 9052 §4.4 lists "The protected attributes from the body structure, encoded in a bstr type" among the `Sig_structure` fields — which is precisely what makes the bucket PROTECTED and separates it from the unprotected one beside it.',
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: LIVE_CLAIMS,
        tamper: { segment: "header" },
      },
    ],
    when: [{ step: "kit-verify", kit: "structured" }],
    then: [
      { step: "rejects", on: "jose", error: "JoseError" },
      { step: "rejects", on: "cose", error: "CoseError" },
    ],
  },

  // ---------------------------------------------------------------------------
  // Certificate binding.
  //
  // ⚠ The COSE shortfall below is a CHAIN of two omissions, not one: the COSE
  // signer never calls `resolveCertBinding`
  // (`src/internal/cose/sign-cwt.ts#export const signCwt = (`),
  // and the header registry maps no COSE label for the thumbprint
  // (`src/internal/header/header-registry.ts#the hash algorithm is a member of the structure`).
  // The domain forward is NO LONGER one of them: the COSE `signClaims`
  // (`src/internal/wire/cose-token-wire.ts#signClaims: ({`) forwards its options
  // structurally, and a caller who STATES a binding is now refused above the seam
  // by the `unsupported` disposition
  // (`src/internal/wire/cose-token-wire.ts#const NO_COSE_CERT_BINDING =`).
  // That refusal is the second of the two capabilities a consumer relies on
  // independently, and it IS raised now; the first — emitting the binding — is
  // what the two remaining sites still owe. Each is pinned where it is owed, and
  // each names only the sites its own repair needs (a refusal puts nothing on the
  // wire, so it owes no registry mapping).
  //
  // The LEGACY SHA-1 thumbprint is a different question with a different answer,
  // and no repair reaches it: RFC 9360 §2 gives COSE ONE `x5t`, whose hash
  // algorithm is a member of the value rather than part of a second parameter
  // name, so there is nothing on that wire for a suppression or an override to
  // act on. The rules about that setting therefore declare COSE `unsupported`
  // rather than defective.
  // ---------------------------------------------------------------------------
  {
    id: "a-token-signed-with-a-certificate-bearing-key-declares-that-certificate",
    title:
      "a token signed by a key that carries a certificate chain names that certificate in its header",
    rationale:
      "A certificate binding is what lets a relying party tie a token to an identity a PKI already vouches for, rather than to a bare key it has no way to attribute. RFC 7515 §4.1.8 defines `x5t#S256` as the base64url-encoded SHA-256 digest of the DER encoding of the certificate corresponding to the key used to digitally sign the JWS, and RFC 9360 §2 registers the same statement for COSE (`x5chain`, label 33, and `x5t`, label 34). A key that HAS a chain and emits no binding leaves the relying party unable to make the attribution at all, and the caller no way to know it did not travel.",
    given: [
      { step: "keys", keys: ["ec-sig-cert"] },
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: { subject: "user-1", audience: [CLIENT] },
        options: {
          context: { accessTokenIssued: false },
          // The vault holds two signing keys; the condition is what puts the
          // cert-bearing one in front of the writer.
          sign: { key: { condition: { id: CERT_SIG_KEY_ID } } },
        },
      },
    ],
    // Asserted on the DOMAIN header, which is wire-agnostic: the two wires spell
    // the parameter differently (a JOSE name against a COSE integer label), and
    // the capability is that the binding ARRIVES, not how it is spelled.
    //
    // ⚠ SCOPED PER WIRE, because the two wires spell the same domain fact with a
    // DIFFERENT NUMBER of parameters. JOSE names the certificate with a PAIR —
    // RFC 7515 §4.1.7 `x5t` (SHA-1) beside §4.1.8 `x5t#S256` (SHA-256) — while
    // RFC 9360 §2 gives COSE a single `x5t` at label 34 whose value is a
    // `COSE_CertHash`: "The 'x5t' header parameter is represented as an array of
    // two elements. The first element is an algorithm identifier … The second
    // element is a binary string containing the hash value computed over the
    // DER-encoded certificate." The digest algorithm is a MEMBER of the one
    // parameter rather than part of two parameter names, so a COSE token names
    // its certificate by exactly ONE digest and there is no legacy second one
    // riding alongside it to observe.
    when: [{ step: "mint" }, { step: "verify" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      {
        step: "header",
        on: "jose",
        expected: {
          certificateThumbprint: CERT_THUMBPRINT,
          certificateThumbprintSha1: CERT_THUMBPRINT_SHA1,
        },
      },
      {
        step: "header",
        on: "cose",
        expected: { certificateThumbprint: CERT_THUMBPRINT },
      },
    ],
    knownDefect: {
      cose: 'TWO sites, and the domain forward is no longer either of them. `src/internal/wire/cose-token-wire.ts#signClaims: ({` — the COSE `signClaims` no longer names its options one by one; it forwards them STRUCTURALLY, and a caller who STATES a binding is refused above the seam by the `unsupported` disposition (`src/internal/wire/cose-token-wire.ts#const NO_COSE_CERT_BINDING =`). This row states none — its key merely CARRIES a chain — so nothing is refused, the mint succeeds, and the token comes back unbound because no COSE writer derives a binding from the key. That is what the two remaining sites owe. `src/internal/cose/sign-cwt.ts#export const signCwt = (` — `signCwt` takes the same `SignStructuredTokenOptions` the JOSE kits take, and consumes `omit`/`tokenType`/`proprietary`/`header`/`unprotected` of them and neither `bindCertificate` nor `certificateThumbprintSha1`; it never calls `resolveCertBinding`, which `src/classes/JwtKit.ts#cert: resolveCertBinding(` does, so a repaired forward has no kit door to hand the request to. And `src/internal/header/header-registry.ts#the hash algorithm is a member of the structure` — `certificateThumbprint` is marked ABSENT on COSE, so `coseByJose` (`src/internal/header/header-registry.ts#header_no_cose_label`) throws `header_no_cose_label` rather than yielding a label to write under; the entry needs mapping to label 34 with an array codec for `COSE_CertHash` (it declares `codec: { kind: "string" }` today, and a COSE_CertHash is a two-element array).',
    },
  },
  {
    id: "a-mint-told-not-to-bind-a-certificate-emits-none",
    title:
      "a token signed by a certificate-bearing key carries no binding when the issuer asks for none",
    rationale:
      "The binding is a STATEMENT about which certificate may present the token, and an issuer that does not want to make it must be able to withhold it — a deployment whose keys happen to carry a chain would otherwise publish a certificate identity on every token it issues, and a relying party configured to enforce the binding would start enforcing one nobody intended. The suppression must therefore be complete: a thumbprint left behind is a binding, whatever the chain parameter says.",
    given: [
      { step: "keys", keys: ["ec-sig-cert"] },
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: { subject: "user-1", audience: [CLIENT] },
        options: {
          context: { accessTokenIssued: false },
          sign: {
            bindCertificate: "none",
            key: { condition: { id: CERT_SIG_KEY_ID } },
          },
        },
      },
    ],
    when: [{ step: "mint" }, { step: "verify" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      {
        step: "header",
        expected: { algorithm: "ES256" },
        excludes: [
          "certificateChain",
          "certificateThumbprint",
          "certificateThumbprintSha1",
        ],
      },
    ],
  },
  {
    id: "a-mint-asked-to-bind-a-certificate-refuses-a-key-that-carries-none",
    title:
      "a mint asked to bind a certificate refuses a signing key that carries no chain",
    rationale:
      "Asking for a certificate binding is a statement that the token must be attributable to a certificate, so a key that has none cannot honour the request. The two alternatives to refusing are both silent: emitting the token unbound leaves the issuer believing its tokens are attributable when they are not, and inventing a thumbprint would bind them to a certificate nobody holds. RFC 7515 §4.1.8 ties `x5t#S256` to 'the certificate corresponding to the key used to digitally sign the JWS' — with no such certificate there is nothing the parameter could truthfully carry.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: { subject: "user-1", audience: [CLIENT] },
        options: {
          context: { accessTokenIssued: false },
          // No `keys` step: the baseline ES512 signing key carries no chain.
          sign: { bindCertificate: "thumbprint" },
        },
      },
    ],
    when: [{ step: "mint" }],
    then: [{ step: "rejects", error: "AegisError" }],
    unsupported: {
      cose: "There is no certificate binding on this wire for a chainless key to fall short of. `KIT_CAPABILITIES.cwt.certificateBinding` is `false` and no COSE writer derives a chain or a thumbprint, so `bindCertificate: \"thumbprint\"` is refused by the wire's `unsupported` disposition before any key is inspected — the SAME refusal a CERT-BEARING key gets from the same option (the sibling row `a-token-signed-with-a-certificate-bearing-key-declares-that-certificate` demonstrates it). This row's capability is that the KEY decides, and on a wire where the key is never consulted the row cannot state that: it would go green on a refusal that has nothing to do with the chain. JOSE has the capability — `resolveCertBinding` reads `kryptos.hasCertificate` — which is what gives the rule something to be about.",
    },
  },
  {
    id: "a-deployment-wide-certificate-thumbprint-default-yields-to-the-call-that-states-its-own",
    title:
      "a call that asks for the legacy certificate thumbprint gets it even where the deployment suppresses it by default",
    rationale:
      "A deployment default and a per-call option are two surfaces answering the same question, and the per-call one is the narrower statement — it is made about ONE token by the code that knows what that token is for. A deployment that has retired the SHA-1 thumbprint (RFC 7515 §4.1.7 `x5t`, whose digest is no longer collision-resistant) still has to be able to issue it for the one legacy relying party that reads nothing else; if the default won, that deployment's only option would be to turn the setting off globally and lose it everywhere.",
    given: [
      { step: "keys", keys: ["ec-sig-cert"] },
      { step: "deployment", settings: { certificateThumbprintSha1: false } },
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: { subject: "user-1", audience: [CLIENT] },
        options: {
          context: { accessTokenIssued: false },
          sign: {
            bindCertificate: "thumbprint",
            certificateThumbprintSha1: true,
            key: { condition: { id: CERT_SIG_KEY_ID } },
          },
        },
      },
    ],
    when: [{ step: "mint" }, { step: "verify" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      {
        step: "header",
        expected: { certificateThumbprintSha1: CERT_THUMBPRINT_SHA1 },
      },
    ],
    unsupported: {
      cose: 'There is no legacy thumbprint on this wire for either surface to decide about. RFC 9360 §2 registers ONE thumbprint parameter for COSE — `x5t` at label 34 — and its value is a `COSE_CertHash`: "The \'x5t\' header parameter is represented as an array of two elements. The first element is an algorithm identifier that is an integer or a string containing the hash algorithm identifier corresponding to the Value column (integer or text string) of the algorithm registered in the \\"COSE Algorithms\\" registry. The second element is a binary string containing the hash value computed over the DER-encoded certificate." The digest algorithm is therefore a MEMBER of the one parameter rather than part of two parameter names, so COSE has no second, SHA-1 parameter riding beside the binding one — and a rule about which surface decides whether that second parameter is emitted cannot be stated where the parameter does not exist. JOSE has the pair (RFC 7515 §4.1.7 `x5t` beside §4.1.8 `x5t#S256`), which is what gives the rule something to be about.',
    },
  },
  {
    id: "a-deployment-that-retires-the-legacy-certificate-thumbprint-emits-none",
    title:
      "a deployment that suppresses the legacy certificate thumbprint issues bound tokens without it",
    rationale:
      "A deployment retires the SHA-1 thumbprint ONCE, at construction, because whether the estate still serves clients that read it is a property of the estate and not of any one call. A default that is accepted and never consulted is the worst outcome: the operator sees the setting, every token still carries the broken-hash digest, and nothing reports the discrepancy. The suppression is also NARROW — RFC 7515 §4.1.7 `x5t` is the legacy digest and §4.1.8 `x5t#S256` is what actually binds the token to a certificate, so a suppression that took the binding with it would silently turn every cert-bound token into an unbound one, which is a larger change than any operator asked for.",
    given: [
      { step: "keys", keys: ["ec-sig-cert"] },
      { step: "deployment", settings: { certificateThumbprintSha1: false } },
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: { subject: "user-1", audience: [CLIENT] },
        // No per-call `certificateThumbprintSha1`: the deployment default is the
        // only thing that can decide here, which is what makes this a statement
        // about the setting rather than about the override that usually rides
        // over it.
        options: {
          context: { accessTokenIssued: false },
          sign: {
            bindCertificate: "thumbprint",
            key: { condition: { id: CERT_SIG_KEY_ID } },
          },
        },
      },
    ],
    when: [{ step: "mint" }, { step: "verify" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      {
        step: "header",
        expected: { certificateThumbprint: CERT_THUMBPRINT },
        excludes: ["certificateThumbprintSha1"],
      },
    ],
    knownDefect: {
      cose: "TWO sites, the same chain the emission row names, and this row does not even reach them. `src/internal/wire/cose-token-wire.ts#signClaims: ({` — the COSE `signClaims` no longer omits the cert-binding options; it forwards them structurally, and this row STATES `bindCertificate`, so the `unsupported` disposition (`src/internal/wire/cose-token-wire.ts#const NO_COSE_CERT_BINDING =`) REFUSES the mint above the seam instead of issuing a token that is silently unbound. The refusal is the honest answer to a request this wire cannot serve, but it is not the EMISSION this row asks for, so the row stays red until the two sites below exist. `src/internal/cose/sign-cwt.ts#export const signCwt = (` — `signCwt` never calls `resolveCertBinding`, so there is no kit door to hand the request to. And `src/internal/header/header-registry.ts#the hash algorithm is a member of the structure` — `certificateThumbprint` is marked ABSENT on COSE, so `coseByJose` (`src/internal/header/header-registry.ts#header_no_cose_label`) throws `header_no_cose_label` and the surviving SHA-256 digest this row requires has no label to travel under until the entry is mapped to RFC 9360 §2's `x5t` (label 34) with a `COSE_CertHash` codec. ⚠ The exclusion half of this cell is VACUOUS on COSE and stays so after every repair: RFC 9360 §2 gives the wire one `x5t` whose hash algorithm is a member of the value, so there is no separate legacy digest for the deployment setting to remove.",
    },
  },

  // ---------------------------------------------------------------------------
  // Sign-then-encrypt.
  // ---------------------------------------------------------------------------
  {
    id: "a-sealed-claims-token-declares-its-nested-content-type",
    title:
      "a token sealed around a signed claims token declares that nesting in its envelope",
    rationale:
      "RFC 7519 §5.2 requires `cty` to be present with the value `JWT` whenever the payload is itself a JWT, so a recipient knows to process the plaintext as a token rather than as opaque bytes; RFC 9052 §3.1 gives COSE the same parameter for the same purpose. Without the declaration a reader holding the key recovers a byte string it has no reason to treat as a credential, and the inner signature — the only thing that says who issued the claims — is never checked.",
    given: [
      { step: "keys", keys: ["ec-enc", "oct-enc"] },
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: { subject: "user-1", audience: [CLIENT] },
        options: { context: { accessTokenIssued: false }, encrypt: {} },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      { step: "accepts", format: { jose: "jwe", cose: "cwe" } },
      // The same declaration in each wire's own vocabulary — the JOSE parameter
      // NAME against the COSE integer LABEL 3 (RFC 9052 §3.1), which §1.5 keeps
      // distinct from the text label "3".
      { step: "wireProtectedHeader", on: "jose", includes: { cty: "JWT" } },
      { step: "wireProtectedHeader", on: "cose", includes: { 3: "application/cwt" } },
    ],
  },
  {
    id: "a-sealed-claims-token-is-re-verified-after-decryption",
    title:
      "a token sealed around a signed claims token is decrypted and its inner signature checked",
    rationale:
      "Encryption provides confidentiality and says nothing about origin. A sealed credential therefore has to be opened AND its inner signature verified before its claims may be believed, and the caller must get the inner token's own header and claims rather than the envelope's — the envelope is written by whoever sealed it, the inner token by whoever issued it, and a floor applied to the wrong one polices the wrong party.",
    given: [
      { step: "keys", keys: ["ec-enc", "oct-enc"] },
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: { subject: "user-1", audience: [CLIENT] },
        options: { context: { accessTokenIssued: false }, encrypt: {} },
      },
    ],
    when: [
      { step: "mint" },
      { step: "verify", profile: "id_token", options: { audience: CLIENT } },
    ],
    then: [
      { step: "accepts", format: { jose: "jwe", cose: "cwe" } },
      { step: "claims", expected: { subject: "user-1", issuer: ISSUER } },
      // The header reported is the INNER token's — an id_token's own media type,
      // not the encrypting outer's. Stated per wire because the two are the same
      // media type in each wire's spelling.
      { step: "header", on: "jose", expected: { headerType: "JWT" } },
      { step: "header", on: "cose", expected: { headerType: "application/cwt" } },
    ],
  },
  {
    id: "an-encrypted-token-with-no-inner-signature-is-refused-by-verify",
    title:
      "an encrypted token whose plaintext is not a signed token is refused by the verify verb",
    rationale:
      "Verification is a statement about ORIGIN, and decryption proves only that the holder had the key — which the presenter also had, since it wrote the ciphertext. A verify that returned the claims of an unsigned encrypted payload would report an authenticated credential assembled entirely by the party presenting it, so a plaintext carrying no signature has to be refused rather than reported.",
    given: [
      { step: "keys", keys: ["ec-enc", "oct-enc"] },
      { step: "token", via: "domain-encrypt", data: { subject: "user-1" } },
    ],
    when: [{ step: "verify" }],
    then: [
      { step: "rejects", on: "jose", error: "AegisDomainError", data: { format: "jwe" } },
      { step: "rejects", on: "cose", error: "AegisDomainError", data: { format: "cwe" } },
    ],
  },

  // ---------------------------------------------------------------------------
  // The confidentiality verb.
  // ---------------------------------------------------------------------------
  {
    id: "the-confidentiality-verb-returns-an-object-under-the-writers-own-keys",
    title:
      "an object sealed by the confidentiality verb is recovered under the keys its writer chose",
    rationale:
      "Encryption is confidentiality and nothing else: it hides a value from everyone without the key and makes no statement about what the value MEANS. A reader that renamed the recovered keys into a registered vocabulary would be asserting, on the writer's behalf, that `subject` is a subject claim and `iss` an issuer — statements only a signature can carry. So a decrypt must hand back the object it was given, key for key, and leave the vocabulary to the verbs that verify an author.",
    given: [
      { step: "keys", keys: ["ec-enc", "oct-enc"] },
      {
        step: "token",
        via: "domain-encrypt",
        data: { subject: "user-1", audience: [CLIENT], tenant: "acme" },
      },
    ],
    when: [{ step: "decrypt" }],
    then: [
      { step: "accepts", format: { jose: "jwe", cose: "cwe" } },
      // The load-bearing half is the KEYS. `subject` is a registered domain name
      // whose wire spellings are `sub` (JOSE) and label 2 (COSE), so any
      // translation on either leg would show up here as a missing key — on the
      // COSE wire the value would not even be a string key.
      {
        step: "raw",
        expected: { subject: "user-1", audience: [CLIENT], tenant: "acme" },
      },
    ],
  },
  {
    id: "the-confidentiality-verb-seals-an-empty-member-with-the-rest-of-the-value",
    title: "an empty member of a sealed object is returned with the object",
    rationale:
      "Pruning an empty entry is a CLAIMS decision — an issuer choosing between `amr: []` (known, none apply) and no `amr` at all (nothing stated) — and it is available to a claims verb because a claim is an assertion someone signed. The confidentiality verb asserts nothing: it seals a value and must hand that same value back, so an empty string, list or object the caller wrote is part of the value and not a statement to second-guess. A caller cannot compensate for a prune it did not ask for, because the loss is silent — the token decrypts cleanly and the member is simply gone.",
    given: [
      { step: "keys", keys: ["ec-enc", "oct-enc"] },
      {
        step: "token",
        via: "domain-encrypt",
        // One of each shape the `"empty"` prune drops, so a prune of any of them
        // shows here rather than only the one that happened to be written.
        data: { blank: "", none: [], empty: {}, kept: "x" },
      },
    ],
    when: [{ step: "decrypt" }],
    then: [
      { step: "accepts", format: { jose: "jwe", cose: "cwe" } },
      { step: "raw", expected: { blank: "", none: [], empty: {}, kept: "x" } },
    ],
  },
  {
    id: "the-confidentiality-verb-round-trips-an-opaque-payload",
    title: "an opaque payload sealed by the confidentiality verb is recovered verbatim",
    rationale:
      "Not everything worth sealing is structured — session state, a handle, a blob of bytes the writer alone interprets. Such a payload must come back as ITSELF, the same JS type and the same content, because a recipient that received a string as bytes (or bytes as a string) has to guess at a conversion the writer never performed.",
    given: [
      { step: "keys", keys: ["ec-enc", "oct-enc"] },
      { step: "token", via: "domain-encrypt", data: "session-state-opaque" },
    ],
    when: [{ step: "decrypt" }],
    then: [
      { step: "accepts", format: { jose: "jwe", cose: "cwe" } },
      { step: "raw", expected: "session-state-opaque" },
    ],
  },
  {
    id: "a-decrypted-token-reports-the-type-its-envelope-declares",
    title: "a decrypted token reports the token type its envelope declared",
    rationale:
      "The envelope's type parameter is what lets a recipient route an encrypted object before it has opened it, and the recipient must then be able to read that declaration back off the result — otherwise the routing decision and the object it routed cannot be correlated, and an application dispatching on the type has to re-decode the envelope with a second reader to find out what it just decrypted.",
    given: [
      { step: "keys", keys: ["ec-enc", "oct-enc"] },
      {
        step: "token",
        via: "domain-encrypt",
        data: { subject: "user-1" },
        options: { type: "access_token" },
      },
    ],
    when: [{ step: "decrypt" }],
    then: [
      { step: "accepts", format: { jose: "jwe", cose: "cwe" } },
      { step: "header", expected: { tokenType: "access_token" } },
    ],
  },
  {
    id: "the-confidentiality-verb-refuses-a-token-that-is-not-encrypted",
    title: "the decrypt verb refuses a token that carries no ciphertext",
    rationale:
      "A decrypt handed a signed token has nothing to decrypt, and the only alternatives to refusing are worse: returning the payload would report a cleartext token as one whose confidentiality had been established, and returning nothing would leave the caller unable to tell success from an empty token. Refusing names the caller's mistake at the point it is made.",
    given: [
      { step: "token", via: "kit-sign", kit: "opaque", claims: { hello: "world" } },
    ],
    when: [{ step: "decrypt" }],
    then: [{ step: "rejects", error: "AegisError" }],
  },
  {
    id: "a-profile-that-cannot-be-sealed-refuses-an-encryption-request",
    title:
      "a mint refuses an encryption request for a profile that declares itself unencryptable",
    rationale:
      "Whether a profile's artifact may be sealed is a property of the artifact's role: an access token is presented to resource servers that were never enumerated at issue, so there is no recipient to seal it to. A request to encrypt one is therefore a caller error, and treating it as a silent no-op is the dangerous reading — the caller believes the token is confidential and handles it accordingly, while it travels in the clear.",
    given: [
      { step: "keys", keys: ["ec-enc", "oct-enc"] },
      {
        step: "token",
        via: "mint",
        profile: "access_token",
        content: { subject: "user-1", audience: [RESOURCE], clientId: CLIENT },
        options: { encrypt: {} },
      },
    ],
    when: [{ step: "mint" }],
    // The `data` names the profile the refusal READ, so it is attributable to the
    // profile's own declaration rather than to the encryption having failed for
    // some other reason — the vault holds a recipient key on both wires, so
    // there is one available to seal to.
    then: [
      { step: "rejects", error: "AegisDomainError", data: { profile: "access_token" } },
    ],
  },
  {
    id: "an-explicit-encryption-request-with-no-recipient-key-is-refused",
    title:
      "a mint asked to seal a token with no resolvable recipient key refuses rather than signing it in the clear",
    rationale:
      "An explicit encryption request is a statement that the content must not travel readable. When no recipient key can be resolved that request cannot be honoured, and the only two outcomes are refusing and emitting cleartext — so the failure must surface. Emitting the token anyway would disclose the content to every intermediary while the caller, having asked for encryption and seen no error, believes it did not.",
    given: [
      // No `keys` step: the vault holds the signing key alone, so there is no
      // recipient the token could be sealed to.
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: { subject: "user-1", audience: [CLIENT] },
        options: { context: { accessTokenIssued: false }, encrypt: {} },
      },
    ],
    when: [{ step: "mint" }],
    then: [{ step: "rejects", error: "AegisKeyError" }],
  },

  // ---------------------------------------------------------------------------
  // The opaque signed artifact.
  // ---------------------------------------------------------------------------
  {
    id: "an-opaque-token-delivers-its-payload-outside-the-claim-buckets",
    title:
      "an opaque signed token delivers its payload as itself, with no claims resolved from it",
    rationale:
      "An opaque signed artifact is a signature over content the issuer alone interprets — a handle, a state blob — and it makes no claims. Resolving its content into claim buckets would report statements nobody made: a key that happens to be spelled like a registered claim would arrive under that claim's meaning and be believed by anything that reads the bucket. The payload therefore has to be delivered whole and the claim buckets left empty.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "opaque",
        claims: { tid: "at_abc", sec: "s3cr3t" },
      },
    ],
    when: [{ step: "verify" }],
    then: [
      { step: "accepts", format: { jose: "jws", cose: "cws" } },
      { step: "raw", expected: { tid: "at_abc", sec: "s3cr3t" } },
      { step: "custom", expected: {}, excludes: ["tid", "sec"] },
    ],
  },
  {
    id: "an-opaque-token-round-trips-a-string-payload-verbatim",
    title: "an opaque signed token round-trips a string payload byte for byte",
    rationale:
      "The content type an opaque artifact negotiates decides how its payload is reconstructed, and a string that came back as anything else — a byte buffer, a parsed object, a truncation — would break every caller that signed one to hand it back to itself later. Verbatim is the only useful contract for content the package does not interpret.",
    given: [{ step: "token", via: "kit-sign", kit: "opaque", claims: "not-a-map" }],
    when: [{ step: "verify" }],
    then: [
      { step: "accepts", format: { jose: "jws", cose: "cws" } },
      { step: "raw", expected: "not-a-map" },
    ],
  },
  {
    id: "an-opaque-token-declares-the-opaque-media-type-for-its-token-type",
    title:
      "an opaque signed token declares a media type that names it opaque, not claims-bearing",
    rationale:
      "RFC 8725 §3.11 recommends explicit typing so a token of one kind cannot be taken for another, and an opaque signature and a claims token are exactly two such kinds: they are the same structure with different contents. The media type is the only thing distinguishing them before the payload is read, so an opaque artifact typed as a claims token would be handed to a claims reader that finds none — and a caller routing on the declaration would treat a handle as a credential.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "opaque",
        claims: { tid: "at_abc" },
        options: { tokenType: "at" },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      { step: "accepts", format: { jose: "jws", cose: "cws" } },
      // The JOSE parameter NAME against the COSE integer LABEL 16 (RFC 9596
      // §4.1), which RFC 9052 §1.5 keeps distinct from the text label "16".
      {
        step: "wireProtectedHeader",
        on: "jose",
        includes: { typ: "application/at+jws" },
      },
      {
        step: "wireProtectedHeader",
        on: "cose",
        includes: { 16: "application/at+cws" },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // The keyless claims read.
  // ---------------------------------------------------------------------------
  {
    id: "the-keyless-claims-read-returns-the-header-and-the-domain-claims",
    title: "a claims token is read keylessly into its header and its domain claims",
    rationale:
      "Before a token can be verified the holder must know which key to fetch and which issuer to ask, and both facts are inside the token. A keyless read is how that circularity is broken, so it has to yield the header and the claims of any claims-bearing artifact — while remaining unverified, so nothing it returns may decide whether the token is accepted.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "default",
        content: { subject: "user-1", expires: "1h", tokenType: "test_token" },
      },
    ],
    when: [{ step: "mint" }, { step: "parse" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      { step: "header", expected: { algorithm: "ES512" } },
      { step: "claims", expected: { subject: "user-1", issuer: ISSUER } },
    ],
  },
  {
    id: "the-keyless-claims-read-accepts-a-token-that-declares-no-type",
    title:
      "a claims token issued elsewhere and carrying no type header is still read keylessly",
    rationale:
      "The keyless read is what a holder does to a token it did NOT issue — that is its whole purpose — so it cannot require a type header this package would have stamped. RFC 7519 §5.1 makes the JOSE `typ` OPTIONAL, and RFC 9596 §2 makes the COSE one optional too, so a claims token that declares none is ordinary and conformant. A reader that routed on the header would answer 'not a token I recognise' for the majority of the third-party tokens it exists to inspect, and the holder would have no way to learn which key or issuer to ask about.",
    given: [
      // FOREIGN on purpose: every aegis writer stamps a type header on both
      // wires and no option suppresses it, so a typ-LESS artifact is not
      // producible here. See `TokenGivenStep`'s foreign member.
      {
        step: "token",
        via: "foreign",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
        },
      },
    ],
    when: [{ step: "parse" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      { step: "claims", expected: { subject: "user-1", issuer: ISSUER } },
      // ⚠ The row's PREMISE, read off the wire by the independent inspector. A
      // producer that stamped a type after all would make this row a statement
      // about an ordinary typed token, which every other read row already
      // covers. RFC 9596 §4.1 registers the COSE `typ` at label 16.
      { step: "wireProtectedHeader", on: "jose", excludes: ["typ"] },
      { step: "wireProtectedHeader", on: "cose", excludes: [16] },
    ],
  },
  {
    id: "the-keyless-claims-read-refuses-an-opaque-token",
    title:
      "the keyless claims read refuses an opaque signed token rather than reporting empty claims",
    rationale:
      "An opaque signed artifact has no claims layer at all, so a claims reader given one has nothing to return. Returning an empty claim set would be indistinguishable from a claims token that happened to carry none, and every presence check a caller then makes passes vacuously — so the reader must say that the artifact is the wrong kind rather than answer as though it were the right one.",
    given: [{ step: "token", via: "kit-sign", kit: "opaque", claims: { tid: "at_abc" } }],
    then: [
      { step: "rejects", on: "jose", error: "AegisDomainError", data: { format: "jws" } },
      { step: "rejects", on: "cose", error: "AegisDomainError", data: { format: "cws" } },
    ],
    when: [{ step: "parse" }],
  },
  {
    id: "the-keyless-claims-read-refuses-an-encrypted-token",
    title:
      "the keyless claims read refuses an encrypted token rather than reporting a partial result",
    rationale:
      "An encrypted token's claims are ciphertext, so a keyless reader cannot see them at all. Anything it returned would be about the envelope and not the content, and a caller reading claims off such a result would be making decisions from an empty set while holding a token full of them. The refusal is what sends the caller to the verb that holds a key.",
    given: [
      { step: "keys", keys: ["ec-enc", "oct-enc"] },
      { step: "token", via: "domain-encrypt", data: "secret" },
    ],
    when: [{ step: "parse" }],
    then: [
      { step: "rejects", on: "jose", error: "AegisDomainError", data: { format: "jwe" } },
      { step: "rejects", on: "cose", error: "AegisDomainError", data: { format: "cwe" } },
    ],
  },
  {
    id: "the-keyless-claims-read-suppresses-a-sensitive-claim-carried-in-cleartext",
    title:
      "a sensitive claim sitting in cleartext is not surfaced by the keyless claims read either",
    rationale:
      "The confidentiality gate is a property of the CLAIM and of how the token was carried, not of which door read it. A sensitive value that travelled unencrypted has already been disclosed to every intermediary, and surfacing it now would spread it further — into the caller's logs and its own storage — while telling the caller the marking did its job. A gate present at one reading door and absent at another is no gate: the value simply arrives through the other one.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
          // The passthrough is what puts a flat sensitive claim on a cleartext
          // wire at all: mint encrypts such a claim or strips it, so no minted
          // token could exercise the read-side gate.
          national_identity_number: NIN,
        },
      },
    ],
    when: [{ step: "parse" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      { step: "bucket", bucket: "sensitive", absent: true },
      // Suppressed means GONE, not relocated: a claim merely demoted out of the
      // sensitive bucket into the custom one is still disclosed.
      { step: "claims", expected: {}, excludes: ["nationalIdentityNumber"] },
      { step: "custom", expected: {}, excludes: ["nationalIdentityNumber"] },
    ],
  },

  // ---------------------------------------------------------------------------
  // The confidentiality gate at the verify door.
  // ---------------------------------------------------------------------------
  {
    id: "a-sensitive-claim-is-delivered-to-the-audience-from-a-sealed-token",
    title:
      "a sensitive claim carried in a sealed token is delivered to the audience in its own bucket",
    rationale:
      "Sealing a sensitive claim is only worth doing if the intended audience still receives it — confidentiality that also withholds the value from the party it was issued for is indistinguishable from omitting it. Delivering it in a bucket of its own is what lets a consumer apply its own handling rules (not logging it, not forwarding it) without re-deriving which of the claims it just received were the sensitive ones.",
    given: [
      { step: "keys", keys: ["ec-enc", "oct-enc"] },
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
    when: [
      { step: "mint" },
      { step: "verify", profile: "id_token", options: { audience: CLIENT } },
    ],
    then: [
      { step: "accepts", format: { jose: "jwe", cose: "cwe" } },
      { step: "bucket", bucket: "sensitive", expected: { nationalIdentityNumber: NIN } },
    ],
  },
  {
    id: "a-sensitive-claim-carried-in-cleartext-is-never-surfaced",
    title:
      "a sensitive claim sitting in cleartext is not surfaced by a verified token either",
    rationale:
      "A sensitive value that arrived unencrypted was already disclosed to every intermediary that handled the token; surfacing it now spreads the disclosure into the consumer's own logs and storage, and does so with the authority of a verified result. The gate has to key off how the token was CARRIED rather than off the claim's category alone, because a valid signature says nothing about who could read the payload on the way.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
          national_identity_number: NIN,
        },
      },
    ],
    when: [{ step: "verify" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      { step: "bucket", bucket: "sensitive", absent: true },
      { step: "claims", expected: {}, excludes: ["nationalIdentityNumber"] },
      { step: "custom", expected: {}, excludes: ["nationalIdentityNumber"] },
    ],
  },

  {
    id: "a-profile-claim-bucket-reaches-the-audience-on-every-encoding",
    title:
      "a profile claim supplied to a mint is written to the wire and read back into its own bucket",
    rationale:
      "OIDC Core §5.1 defines the standard profile claims (`given_name`, `email`, …) as the ones an audience reads to learn about the end-user, and the read side categorises them into a bucket of their own so a consumer can hand exactly that set to a rendering or provisioning path without re-deriving the categorisation. Write and read are separate code on each encoding, so a bucket one side fills and the other does not — or vice versa — loses the claims SILENTLY: the token mints, it verifies, and the values are simply gone, with no error on either side to say the caller's content was dropped.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: {
          subject: "user-1",
          audience: [CLIENT],
          profile: { givenName: "Ada", email: "ada@example.com" },
        },
        options: { context: { accessTokenIssued: false } },
      },
    ],
    when: [
      { step: "mint" },
      { step: "verify", profile: "id_token", options: { audience: CLIENT } },
    ],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      // BOTH halves, because either alone passes over the failure this states.
      // The independent read is the WRITE half — the claims reached the wire —
      // and the bucket is the READ half. A write that dropped them and a read
      // that reported an empty bucket agree with each other perfectly.
      { step: "wireClaims", includes: { given_name: "Ada", email: "ada@example.com" } },
      {
        step: "bucket",
        bucket: "profile",
        expected: { givenName: "Ada", email: "ada@example.com" },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Delegation.
  // ---------------------------------------------------------------------------
  {
    id: "a-delegated-token-reports-its-act-chain",
    title:
      "a token presented by an actor on a subject's behalf reports that delegation on the result",
    rationale:
      "RFC 8693 §4.1 defines `act` as the claim that names the party currently acting for the subject, and its whole purpose is that the recipient can tell a delegated presentation from a direct one. A result that dropped the chain would report the token as though the subject had presented it, so every authorisation decision downstream would attribute the request to the wrong party — and an actor policy stated against it would have nothing to read.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
          act: { sub: "service-a" },
        },
      },
    ],
    when: [{ step: "verify" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      { step: "bucket", bucket: "delegation", expected: { isDelegated: true } },
    ],
  },

  // ---------------------------------------------------------------------------
  // The token identifier matcher — the one claim whose wire name diverges.
  // ---------------------------------------------------------------------------
  {
    id: "a-token-identifier-matcher-accepts-the-identifier-the-token-carries",
    title:
      "a caller asserting the token identifier it expects is answered from the claim the wire carries",
    rationale:
      "RFC 7519 §4.1.7 makes `jti` the identifier a replay check keys on, and RFC 8392 §3.1.7 registers the same claim under the name `cti` on the COSE wire — the one registered claim whose spelling differs between the two. A matcher keyed to one spelling and applied to the other finds nothing, so a caller that correlated a token with its own stored record would be told it did not match a token that does.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
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
    when: [{ step: "verify", assert: { tokenId: "token-1" } }],
    then: [{ step: "accepts", format: { jose: "jwt", cose: "cwt" } }],
  },
  {
    id: "a-token-identifier-matcher-refuses-a-different-identifier",
    title: "a caller asserting a token identifier the token does not carry is refused",
    rationale:
      "A matcher that accepts every value is not a matcher, and one applied to a claim it cannot find accepts every value — including the case where the presented token is a different token entirely. Refusing a mismatch is what makes the accepting direction mean anything: without it the assertion would be satisfied by any token at all, which is precisely how a correlation check stops correlating.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
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
    when: [{ step: "verify", assert: { tokenId: "not-the-token-id" } }],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "a-token-identifier-existence-matcher-sees-the-identifier-the-token-carries",
    title:
      "a caller asserting that no token identifier is present is refused by a token that carries one",
    rationale:
      "This is the fail-OPEN direction of the same divergence, and the one that matters: a replay guard asking whether a token carries an identifier at all must not be told 'no' about a token that carries one. A predicate keyed to the wrong wire name finds nothing and answers that the claim is absent, which is an affirmative wrong answer rather than a missing one — the guard passes, records nothing, and the token can be replayed.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
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
    when: [{ step: "verify", assert: { tokenId: { $exists: false } } }],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },

  // ---------------------------------------------------------------------------
  // Temporal policy independence.
  // ---------------------------------------------------------------------------
  {
    id: "waiving-the-expiry-range-check-does-not-waive-the-audience-floor",
    title:
      "a token whose expiry check was waived is still refused when it names another audience",
    rationale:
      "Each verify option waives exactly the check it names. Waiving the expiry range has a narrow legitimate purpose — inspecting a previously-issued token whose signature, not its lifetime, is what matters — and a caller doing so is not asking to accept tokens minted for somebody else. An option whose effect spilled onto neighbouring checks would make every such inspection a hole, and the caller would have no way to tell from the call site.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
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
    when: [
      {
        step: "verify",
        profile: "default",
        options: {
          audience: "https://elsewhere.lindorm.io/",
          verifyExpiration: false,
        },
      },
    ],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "the-expiry-presence-policy-is-independent-of-the-expiry-range-check",
    title:
      "a token carrying no expiry at all is still refused when only the expiry range check was waived",
    rationale:
      "Presence and range are two different questions about `exp`: whether the issuer stated a lifetime, and whether that lifetime has run out. A token that states none never expires, so the presence requirement is the only thing standing between a verifier and a credential that works forever — and a caller waiving the range check is asking to accept an expired token, which is a token that DID state a lifetime. Folding the two into one flag turns a narrow waiver into an unbounded one.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          // No `exp` at all — the presence question, not the range one.
          iat: NOW,
          jti: "token-1",
        },
      },
    ],
    when: [{ step: "verify", options: { verifyExpiration: false } }],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "an-empty-verify-option-bag-is-the-same-call-as-none",
    title:
      "a verify called with an empty option bag reaches the same verdict as one called with none",
    rationale:
      "An option bag states what the caller wants CHANGED, so a bag stating nothing is the same request as no bag at all. Behaviour that turned on the presence of `{}` could not be predicted from the signature and could not be discovered except by trying both, and the direction it would be discovered in is the dangerous one: a defaulting path reached only when the caller passes nothing is a path most callers never take.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          iat: NOW,
          jti: "token-1",
        },
      },
    ],
    // The twin of this call — the same token, the same act, no options bag at
    // all — is stated by `a-domain-refusal-names-the-wire-it-refused`.
    when: [{ step: "verify", options: {} }],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },

  // ---------------------------------------------------------------------------
  // The empty-claim prune.
  // ---------------------------------------------------------------------------
  {
    id: "the-structured-signing-namespace-prunes-an-empty-claim-by-default",
    title: "an empty claim is left off the wire unless the issuer asks for it to be kept",
    rationale:
      "An empty claim and an absent one are different statements: `amr: []` asserts that the authentication methods are known and none apply, while omitting `amr` asserts nothing. Most callers assemble their claim bag from optional values and mean the second, so the default has to be to prune — otherwise every unset field becomes a positive assertion of emptiness that the issuer never made and the audience is entitled to act on.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
          empty_list: [],
        },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      { step: "wireClaims", excludes: ["empty_list"] },
    ],
  },
  {
    id: "the-structured-signing-namespace-keeps-an-empty-claim-when-told-to",
    title:
      "an empty claim survives to the wire when the issuer states the prune mode that keeps it",
    rationale:
      "An issuer that means the positive statement — these are known, and none apply — must be able to make it, or the vocabulary loses a distinction the specifications rely on. The prune mode is how the choice is stated, so a mode that was accepted and not applied would silently rewrite the token's meaning while reporting success.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
          empty_list: [],
        },
        options: { omit: "undefined" },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      { step: "wireClaims", present: ["empty_list"] },
    ],
  },
  {
    id: "an-event-payload-survives-the-empty-claim-prune",
    title:
      "a security event whose payload is the conventional empty object is kept on the wire",
    rationale:
      "RFC 8417 §2.2 defines the `events` claim as a JSON object whose members are URIs identifying event statements, and says of each member value that 'The JSON object MAY be an empty object (\"{}\")'. OpenID Connect Back-Channel Logout 1.0 §2.4 makes that the normal case: the logout token carries the member `http://schemas.openid.net/event/backchannel-logout`, whose value 'MUST be a JSON object and SHOULD be the empty JSON object {}' — the member's presence is the whole statement. A prune that removed empty containers indiscriminately would therefore delete the event itself, leaving a logout token that names no event and identifies nothing to act on.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "logout_token",
        content: {
          subject: "user-1",
          audience: [CLIENT],
          events: { [BACKCHANNEL_LOGOUT]: {} },
        },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      { step: "wireClaims", present: ["events"] },
    ],
  },

  // ---------------------------------------------------------------------------
  // A verify-only profile's structural policy.
  // ---------------------------------------------------------------------------
  {
    id: "a-verify-only-profile-enforces-its-issuer-shape-on-arrival",
    title:
      "a third-party token whose issuer is not a URI is refused by the profile that demands one",
    rationale:
      "A profile written to accept tokens from an issuer we do not control is the one whose structural policy MUST run on the verify path — it can never run anywhere else, because nothing on this side ever mints such a token. ⚠ Requiring the issuer to be a URI is AEGIS POLICY, not a citation: RFC 7519 §4.1.1 types `iss` as a StringOrURI, which expressly admits a bare string carrying no colon, so the specification permits exactly what this refuses. The policy exists because the issuer identifier is what scopes key lookup — a bare identifier names no origin that can be resolved or compared, so accepting one lets the presenter name an issuer nobody can check. It sits deliberately between the two published bars: looser than OIDC Core §2, which requires 'a case-sensitive URL using the https scheme that contains scheme, host, and optionally, port number and path components and no query or fragment components', because a third-party issuer need not be an OIDC provider.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: "acme-corp-not-a-uri",
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
        },
      },
    ],
    when: [
      {
        step: "verify",
        profile: "external_access_token",
        options: { audience: RESOURCE },
      },
    ],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "a-verify-only-profile-refuses-an-envelope-that-expires-before-it-was-issued",
    title:
      "a token that expires before it was issued is refused as structurally incoherent",
    rationale:
      "RFC 7519 §4.1.4 defines `exp` as the instant on or after which the token must not be accepted and §4.1.6 defines `iat` as when it was issued, so a token whose expiry precedes its issuance describes a lifetime that never existed. No temporal range check catches it — each claim can be individually plausible — so the incoherence has to be caught as a relationship between them, or a token nobody could have legitimately produced passes every individual test.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW + 7200,
          jti: "token-1",
        },
      },
    ],
    when: [
      {
        step: "verify",
        profile: "external_access_token",
        options: {
          audience: RESOURCE,
          // The kit's own upper bound on `iat` would refuse this token first,
          // and the row is about the RELATIONSHIP between the two claims. Lifting
          // that one bound is what lets the structural rule be the thing that
          // rejects it.
          verifyIssuedAt: false,
        },
      },
    ],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "the-envelope-claims-a-profile-injects-reach-the-wire-under-their-registered-names",
    title:
      "the envelope claims a profile injects for the caller arrive on the wire under their registered names",
    rationale:
      "A profile injects the envelope claims a caller should not have to remember — who issued the token, when, and under what identifier. Each is a REGISTERED claim with a name of its own on each wire (RFC 7519 §4.1.1/§4.1.6/§4.1.7 name `iss`, `iat` and `jti`; RFC 8392 §3.1.1/§3.1.6/§3.1.7 give the CWT the labels 1, 6 and 7), so a value injected under a domain name and never translated arrives as an unregistered custom claim that looks right and answers nothing — no verifier's issuer check, replay cache or freshness bound reads it. Injection is also EXACTLY what the profile declares: a profile that does not name `notBefore` must not stamp one, or every token it issues carries a lower bound its issuer never chose.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "access_token",
        content: { subject: "user-1", audience: [RESOURCE], clientId: CLIENT },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      // Read through the INDEPENDENT inspector, in each wire's own vocabulary.
      // `jti`/`cti` is asserted by PRESENCE rather than by value: it is generated
      // per token, and on COSE it rides as a byte string that never equals the
      // text it spells.
      {
        step: "wireClaims",
        on: "jose",
        includes: { iss: ISSUER, iat: NOW },
        present: ["jti"],
        excludes: ["nbf"],
      },
      {
        step: "wireClaims",
        on: "cose",
        includes: { 1: ISSUER, 6: NOW },
        present: [7],
        excludes: [5],
      },
    ],
  },
  {
    id: "a-verify-only-profile-accepts-a-token-naming-several-audiences-and-no-client",
    title:
      "a profile written for a third party's access tokens accepts several audiences and no client identifier",
    rationale:
      "The shape a third-party authorization server actually emits is not the shape this package issues, and a profile that exists to READ one has to admit it. RFC 7519 §4.1.3 makes the multi-valued `aud` the general case — 'In the general case, the \"aud\" value is an array of case-sensitive strings' — and RFC 9068 §2.2 lists `client_id` as REQUIRED only for tokens issued under ITS profile, which a foreign server is under no obligation to follow. A resource server that could not read such a token would have no way to accept its own partners' tokens at all, and the usual workaround is to stop checking anything.",
    given: [
      // FOREIGN on purpose: what is under test is whether the profile admits a
      // wire an ordinary third-party server emits, so a token built by the code
      // under test would prove nothing.
      {
        step: "token",
        via: "foreign",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE, "account"],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
          scope: "openid profile",
        },
      },
    ],
    when: [
      {
        step: "verify",
        profile: "external_access_token",
        options: { audience: RESOURCE, issuer: ISSUER },
      },
    ],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      {
        step: "claims",
        expected: { subject: "user-1", audience: [RESOURCE, "account"] },
      },
    ],
  },
  {
    id: "a-type-outside-the-claims-media-grammar-never-reaches-a-profile",
    title:
      "a token whose declared type is not a claims media type is refused before any profile is consulted",
    rationale:
      "The type header is what says which grammar a token's body follows, and the check that it names a claims media type is a WIRE guard: it is what stops a signed artifact of another kind being read as a claim set at all. RFC 7519 §5.1 admits the bare `JWT` and, through the media-type suffix registered in RFC 6838 §4.2.8, the `<type>+jwt` forms; RFC 9596 §2 gives the COSE parameter the same role. A bare word that is neither is outside the grammar, so no profile can be reached to admit it — which is a limit worth stating plainly, because the tokens it excludes are real ones some deployments emit.",
    given: [
      {
        step: "token",
        via: "foreign",
        typ: "Bearer",
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
    when: [
      {
        step: "verify",
        profile: "external_access_token",
        options: { audience: RESOURCE, issuer: ISSUER },
      },
    ],
    then: [
      { step: "rejects", on: "jose", error: "JoseError" },
      { step: "rejects", on: "cose", error: "CoseError" },
    ],
  },
  {
    id: "a-profile-declared-for-verification-only-refuses-to-mint",
    title: "a profile that exists to check someone else's tokens refuses to issue one",
    rationale:
      "A profile written to READ a third party's tokens carries their rules, not ours — a relaxed type policy, a foreign issuer, no client identifier. Minting under it would emit a token signed with THIS deployment's key while wearing a policy chosen for somebody else's, which is a degraded token issued by accident and indistinguishable, on the wire, from a deliberate one. The direction a profile is used in is therefore part of the profile, and a mint under a verify-only one has to fail rather than produce a lesser token.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "external_access_token",
        // ⚠ LOCAL cast, deliberate: `ProfileContentFor` resolves a verify-only
        // profile's content to `never`, so this call site does NOT compile — which
        // is the type-level half of the same capability, held in the compile-time
        // companion beside `IAegis`. The cast is what lets the row state the
        // RUNTIME half, for a caller reaching the API from untyped code.
        content: {
          issuer: "https://other-idp.lindorm.io/",
          subject: "user-1",
          audience: [RESOURCE],
        } as never,
        // The envelope claims are supplied so the refusal cannot be mistaken for
        // a mint that merely failed on the `iat`/`jti` it would not generate.
        // ⚠ LOCAL cast on the instant, deliberate: the option declares a `Date`
        // and a row carries only JSON, so it is a date CELL the interpreter
        // revives. The key names are still checked.
        options: {
          sign: {
            issuedAt: { date: DEFAULT_INSTANT } as unknown as Date,
            tokenId: "token-1",
          },
        },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: { profile: "external_access_token", use: "verify" },
      },
    ],
  },
  {
    id: "a-policy-conformant-third-party-token-verifies-under-a-verify-only-profile",
    title: "a third-party token that satisfies the profile's structural policy verifies",
    rationale:
      "A structural policy has to refuse exactly the tokens that violate it and no others. A profile that rejected conformant tokens would be discovered only in production, by a deployment whose partner's tokens were correct all along — and the usual remedy is to stop using the profile, which removes every rule it carried rather than the one that was wrong.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
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
    when: [
      {
        step: "verify",
        profile: "external_access_token",
        options: { audience: RESOURCE },
      },
    ],
    then: [{ step: "accepts", format: { jose: "jwt", cose: "cwt" } }],
  },

  // ---------------------------------------------------------------------------
  // The caller's matcher bag — what a verify is asked to check BEYOND the floor.
  // ---------------------------------------------------------------------------
  {
    id: "a-scalar-audience-matcher-is-satisfied-by-any-member-of-a-multi-valued-audience",
    title:
      "a caller asserting one audience is answered by a token naming that audience among several",
    rationale:
      "RFC 7519 §4.1.3 — 'In the general case, the \"aud\" value is an array of case-sensitive strings, each containing a StringOrURI value. In the special case when the JWT has one audience, the \"aud\" value MAY be a single case-sensitive string' — so the MULTI-valued form is the general one, and RFC 8392 §3.1.3 gives the CWT claim the same meaning and processing rules. A resource server asserting its own identity is asking whether it is AMONG the audiences, never whether it is the only one, so a matcher compiled to an equality test answers 'no' for every token in the general form — and the deployments it breaks are exactly the ones whose issuer did the ordinary thing.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE, "https://other.lindorm.io/"],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
        },
      },
    ],
    when: [{ step: "verify", assert: { audience: RESOURCE } }],
    then: [{ step: "accepts", format: { jose: "jwt", cose: "cwt" } }],
  },
  {
    id: "a-scalar-audience-matcher-an-audience-does-not-contain-is-refused",
    title: "a caller asserting an audience the token does not name is refused",
    rationale:
      "Containment is only a check if the absent case fails. A matcher relaxed until every token satisfies it is worse than no matcher: the caller believes the token was checked against its own identity and stops checking, which is the exact state a replayed token needs to be useful.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE, "https://other.lindorm.io/"],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
        },
      },
    ],
    when: [{ step: "verify", assert: { audience: "https://elsewhere.lindorm.io/" } }],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "the-hash-claims-are-derived-from-the-raw-sources-a-caller-presents",
    title:
      "a caller presenting the raw access token, code and state is answered from the hash claims the token carries",
    rationale:
      "The three hash claims come from TWO specifications and are defined the same way in both. OIDC Core §3.1.3.6 defines `at_hash` as 'the base64url encoding of the left-most half of the hash of the octets of the ASCII representation of the access_token value' and §3.3.2.11 defines `c_hash` over the `code`; `s_hash` is not an OIDC Core claim at all — Financial-grade API Security Profile 1.0 Part 2 (Advanced) §5.1.1 defines it over the `state` in identical terms. All three name the hash algorithm the same way, as 'the hash algorithm used in the alg header parameter of the ID Token's JOSE header'. A relying party holds the raw artifacts, never the digests, so the comparison has to happen where the SIGNING ALGORITHM is known — and `alg` is a header parameter. A verify that could not take the raw source would push the derivation onto every caller, and a caller that derives it from the wrong algorithm gets a mismatch it cannot explain.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "default",
        content: {
          subject: "user-1",
          expires: "1h",
          tokenType: "test_token",
          accessToken: AT_SOURCE,
          authCode: CODE_SOURCE,
          authState: STATE_SOURCE,
        },
      },
    ],
    when: [
      { step: "mint" },
      {
        step: "verify",
        assert: {
          accessToken: AT_SOURCE,
          authCode: CODE_SOURCE,
          authState: STATE_SOURCE,
        },
      },
    ],
    then: [{ step: "accepts", format: { jose: "jwt", cose: "cwt" } }],
  },
  {
    id: "a-raw-source-that-does-not-hash-to-the-claim-the-token-carries-is-refused",
    title:
      "a caller presenting an access token the id token was not issued for is refused",
    rationale:
      "OIDC Core §3.1.3.6 exists so a relying party can detect an access token substituted for the one the id token was issued alongside. The binding therefore has to FAIL for the substituted artifact — a derivation that computed a digest and then compared nothing would report success for every pair, which is the single condition the claim was added to make detectable.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "default",
        content: {
          subject: "user-1",
          expires: "1h",
          tokenType: "test_token",
          accessToken: AT_SOURCE,
        },
      },
    ],
    when: [
      { step: "mint" },
      { step: "verify", assert: { accessToken: "a-different-access-token" } },
    ],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "an-issuer-matcher-written-as-a-condition-is-evaluated-rather-than-compared",
    title:
      "a caller bounding the issuer with a condition is refused by a token naming another issuer",
    rationale:
      "An issuer bound is rarely a bare equality: a client accepting tokens from several deployments, or accepting one only when the claim is present at all, has to express that as a condition. A surface that took the condition and compared it as a VALUE would find no token whose `iss` equals an object, so it could only ever refuse — and a surface that took it and ignored it could only ever accept. The refusing direction is the one that must be pinned, because an unevaluated matcher fails OPEN: the caller stated a bound and every issuer satisfies it.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
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
    when: [
      {
        step: "verify",
        assert: {
          issuer: { $or: [{ $exists: false }, { $eq: "https://other.lindorm.io/" }] },
        },
      },
    ],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "a-profiled-verify-applies-the-caller-matcher-beside-its-own-floor",
    title:
      "a profiled verify refuses a caller matcher the token does not satisfy even when the profile floor passes",
    rationale:
      "The profiled call takes the SAME matcher argument as the profile-less one, and a caller passing one is stating a requirement the profile knows nothing about — which resource this token is for, which subject, which scope. A path that satisfied the floor and dropped the matcher would report success on the profile alone, so the caller's requirement would be silently unenforced while every profile rule still looked like it was working. The construction that shows it is the one where the floor's own audience is SATISFIED and only the caller's is false: a refusal then can only have come from the matcher.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "access_token",
        content: { subject: "user-1", audience: [RESOURCE], clientId: CLIENT },
      },
    ],
    when: [
      { step: "mint" },
      {
        step: "verify",
        profile: "access_token",
        assert: { audience: "https://other.lindorm.io/" },
        options: { audience: RESOURCE },
      },
    ],
    // No `data`. What makes this refusal attributable is the CONSTRUCTION: the
    // floor's own `audience` is satisfied by the same token, so nothing but the
    // caller's matcher can be refusing it. Which claim NAMES the failure is a
    // separate statement, and it is made by
    // `a-domain-refusal-names-the-claims-in-the-vocabulary-the-caller-used`.
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "a-domain-refusal-names-the-claims-in-the-vocabulary-the-caller-used",
    title:
      "a refused claim matcher is reported under the domain claim name the caller stated it with",
    rationale:
      "The domain surface exists so a caller states claims in ONE vocabulary and never has to know the wire's. It takes `tokenId` and returns `tokenId`, and it does so precisely because the wire spellings diverge — RFC 7519 §4.1.7 calls the claim `jti` and RFC 8392 §3.1.7 registers the same claim as `cti` on COSE. A refusal that reports the WIRE name hands that divergence straight back: the caller receives a name it never wrote, and receives a DIFFERENT one depending on which encoding the issuer chose, so the only way to act on the failure is to carry a private reverse map of every claim on both wires. It also makes one field mean two things — the policy floor and the static claim matcher both report this list in domain names — so a consumer reading `invalid` cannot tell which vocabulary it was handed.",
    // ⚠ `data` IS pinned on a row carrying a knownDefect, which the general rule
    // above discourages — and the reason it does not apply here is that the
    // refusal is fully observable today. The error is thrown, and it already
    // carries an `invalid` list; the shortfall is its CONTENTS, not the shape of
    // an error that does not exist yet. So this is read off the real error and
    // states what that same field must hold, rather than guessing at a fix.
    knownDefect:
      "`src/internal/utils/apply-verify-policy.ts#const predicate = createIdentityMatchers(` — the caller's matcher bag is compiled by `createIdentityMatchers(algorithm, assert, nameOf)`, where `nameOf` is the WIRE `NameSelector`, and validated against `wireClaims`; the catch (`src/internal/utils/apply-verify-policy.ts#data: { invalid: (err as any).data?.invalid, format },`) then copies the failing key list into `data.invalid` verbatim. So the list is WIRE-spelled — `jti` on JOSE and `cti` on COSE for the same `tokenId` matcher — while `Aegis.assert` (`src/classes/Aegis.ts#static assert(`) and the profile floor's `profile_policy_invalid` both report the same field in DOMAIN names. The failing keys need translating back through the registry before they reach the error.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
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
    // `tokenId` is the matcher that makes the consequence undeniable: it is the
    // one registered claim whose wire spelling differs between the two wires, so
    // a wire-spelled report is not merely unfamiliar, it is inconsistent.
    when: [{ step: "verify", assert: { tokenId: "not-the-token-id" } }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: { invalid: ["tokenId"] },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // The RAW claims-verify door — the same options, threaded by different code.
  // ---------------------------------------------------------------------------
  {
    id: "the-raw-opaque-verify-checks-the-signature-over-an-arbitrary-payload",
    title:
      "an opaque signed artifact verifies through its own raw door and returns the payload it was signed over",
    rationale:
      "RFC 7515 §1 secures 'an arbitrary sequence of octets', so the opaque door is the one a caller uses for a payload that is not a claim set — a stored blob, an encoded record — and it is a SEPARATE forward from the claims door with its own key resolution and its own verify call. A door that could sign but not verify would leave every such artifact unreadable by the package that wrote it, and there would be no other surface to reach it from: the claims reader refuses an opaque artifact by design rather than returning an empty claim set.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "opaque",
        claims: { tid: "at_abc", scope: "openid" },
      },
    ],
    when: [{ step: "kit-verify", kit: "opaque" }],
    then: [{ step: "accepts" }],
  },
  {
    id: "the-raw-claims-verify-accepts-a-token-that-declares-no-type",
    title: "the raw claims verify accepts a token that carries no type header",
    rationale:
      "RFC 7519 §5.1 makes `typ` OPTIONAL — 'This parameter is ignored by JWT implementations; any processing of this parameter is performed by the JWT application' — and RFC 9596 §2 says the same of the COSE parameter, so a typ-less claims token is conformant on either wire. Whether to accept one is an APPLICATION policy, which is where the domain surface enforces it; the raw wire door is not the application, so a presence rule imposed there would refuse conformant tokens with no way for the caller to say otherwise.",
    given: [
      {
        step: "token",
        via: "foreign",
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
    // The CONTRAST is the `typPresence` knob probe, which puts this same
    // typ-less foreign token in front of the DOMAIN door and watches it refused.
    when: [{ step: "kit-verify", kit: "structured" }],
    then: [
      { step: "accepts" },
      // ⚠ The row's PREMISE, read off the wire. Without it the row accepts an
      // ordinary typed token and says nothing about typ-lessness at all.
      // RFC 9596 §4.1 registers the COSE `typ` at label 16.
      { step: "wireProtectedHeader", on: "jose", excludes: ["typ"] },
      { step: "wireProtectedHeader", on: "cose", excludes: [16] },
    ],
  },
  {
    id: "the-raw-claims-verify-honours-a-waived-expiry-range-check",
    title:
      "the raw claims verify accepts an expired token when the caller waives the expiry range",
    rationale:
      "RFC 7519 §4.1.4 makes `exp` a bound a verifier enforces, and waiving it is a narrow, legitimate request — inspecting a previously-issued token where the signature, not the lifetime, is what is being trusted. The raw door threads its own option bag by hand, so it can honour an option the domain door honours and drop the one beside it; the caller sees no difference, because a dropped waiver simply rejects and a dropped tightening simply accepts.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
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
    // The CONTRAST is `a-token-failure-is-always-an-aegis-error-at-the-kit-verify-door`:
    // the same door and the same expired shape, with no option, refused.
    when: [
      { step: "kit-verify", kit: "structured", options: { verifyExpiration: false } },
    ],
    then: [{ step: "accepts" }],
  },
  {
    id: "the-raw-claims-verify-honours-a-caller-supplied-clock-tolerance",
    title:
      "the raw claims verify accepts a token expired inside the leeway the caller allows",
    rationale:
      "RFC 7519 §4.1.4 allows 'some small leeway, usually no more than a few minutes, to account for clock skew' when checking `exp`. The leeway is a NUMBER rather than a flag, so it is the option that shows the whole bag reaches the raw door and not merely the booleans a hand-written forward is most likely to remember: a token ten seconds past its expiry must verify under a sixty-second allowance and fail without one.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW - 10,
          iat: NOW - 3600,
          jti: "token-1",
        },
      },
    ],
    when: [{ step: "kit-verify", kit: "structured", options: { clockTolerance: 60 } }],
    then: [{ step: "accepts" }],
  },
  {
    id: "the-raw-claims-verify-honours-a-caller-supplied-key-policy",
    title:
      "the raw claims verify refuses a token whose signing key the caller's policy forbids",
    rationale:
      "RFC 8725 §3.1 puts the restriction in the caller's hands and makes honouring it mandatory — 'Libraries MUST enable the caller to specify a supported set of algorithms and MUST NOT use any other algorithms when performing cryptographic operations.' The raw door is where a caller reaches the wire directly, so a policy dropped there is worse than no policy at all: the caller believes the constraint is in force and stops checking, and the token's own header is left to decide which vault resident verifies it.",
    given: [{ step: "token", via: "kit-sign", kit: "structured", claims: LIVE_CLAIMS }],
    // The vault's signing key is the ES512 one, so a policy demanding a shared
    // secret can only be satisfied by ignoring the policy.
    when: [
      {
        step: "kit-verify",
        kit: "structured",
        options: { key: { condition: { algClass: "symmetric" } } },
      },
    ],
    then: [{ step: "rejects", error: "AegisKeyError" }],
  },

  // ---------------------------------------------------------------------------
  // Delegation, and the actor policy a verifier states over it.
  //
  // RFC 8693 §4.1: "A chain of delegation can be expressed by nesting one 'act'
  // claim within another. The outermost 'act' claim represents the current actor
  // while nested 'act' claims represent prior actors." Everything below is a
  // policy over that structure.
  // ---------------------------------------------------------------------------
  {
    id: "a-token-that-names-no-actor-reports-an-empty-delegation-chain",
    title: "a token presented by its own subject reports a delegation bucket saying so",
    rationale:
      "RFC 8693 §4.1 — the `act` claim is what 'express[es] that delegation has occurred'. Its ABSENCE is therefore a positive statement about the presentation, and the result has to carry that statement rather than leave the bucket off: a consumer reading `isDelegated` off an absent bucket reads `undefined`, which is falsy, so the direct case and the case where the read side simply lost the chain become indistinguishable — and the second is the one that misattributes a delegated request to the subject.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
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
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      {
        step: "bucket",
        bucket: "delegation",
        expected: { isDelegated: false, actorChain: [] },
      },
    ],
  },
  {
    id: "an-actor-requirement-accepts-a-token-that-names-an-actor",
    title:
      "a verifier demanding a delegated presentation accepts a token that names an actor",
    rationale:
      "A requirement has to refuse exactly the presentations that fail it. An endpoint that only ever serves delegated calls states this so an undelegated token cannot reach it; if the requirement also refused the delegated tokens it was written for, the endpoint could not be used at all, and the remedy a deployment reaches for is to drop the requirement rather than narrow it — which removes the refusal that mattered.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
          act: { sub: "service-1" },
        },
      },
    ],
    when: [{ step: "verify", options: { actor: { required: true } } }],
    then: [{ step: "accepts", format: { jose: "jwt", cose: "cwt" } }],
  },
  {
    id: "an-actor-prohibition-refuses-a-token-that-names-one",
    title: "a verifier that accepts only direct presentations refuses a delegated token",
    rationale:
      "RFC 8693 §4.1 — an `act` claim says the request is being made by a party acting FOR the subject rather than by the subject. An operation that must be performed by the end-user in person — a credential change, a consent — is authorised by the subject and not by anyone acting for them, so the verifier needs a way to refuse the delegated form outright. Without it the only remaining defence is that every downstream check happens to notice the actor, which none of them are written to do.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
          act: { sub: "service-1" },
        },
      },
    ],
    when: [{ step: "verify", options: { actor: { forbidden: true } } }],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "an-actor-allowlist-accepts-a-chain-whose-every-actor-it-names",
    title:
      "a verifier listing the actors it trusts accepts a chain drawn entirely from that list",
    rationale:
      "An allowlist is a constraint on WHO may act, and it has to admit the deployments it was written for: a request that legitimately passed through two named intermediaries must verify. A list that refused its own members would be discovered only when the second hop was added, and the fix applied under pressure is to widen the list to everything.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
          act: { sub: "service-1", act: { sub: "service-2" } },
        },
      },
    ],
    when: [
      {
        step: "verify",
        options: {
          actor: { allowedActors: { subject: { $in: ["service-1", "service-2"] } } },
        },
      },
    ],
    then: [{ step: "accepts", format: { jose: "jwt", cose: "cwt" } }],
  },
  {
    id: "an-actor-allowlist-refuses-a-chain-carrying-an-actor-it-does-not-name",
    title:
      "a verifier listing the actors it trusts refuses a chain in which a prior actor is not listed",
    rationale:
      "⚠ Checking the WHOLE chain by default is AEGIS POLICY and deliberately stricter than the specification's guidance: RFC 8693 §4.1 says consumers 'only consider the token's top-level claims and the party identified as the current actor by the \"act\" claim. Prior actors identified by any nested \"act\" claims are informational only and are not to be considered in access control decisions.' aegis defaults to the strict reading because a chain is a record of everyone who has HELD the token, and a party that held it could have altered the request it was used for; a deployment that wants the specification's reading asks for it explicitly with the current-actor scope. Whichever reading applies, an allowlist that admitted an unlisted actor would be no list at all.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
          act: { sub: "service-1", act: { sub: "rogue" } },
        },
      },
    ],
    when: [
      {
        step: "verify",
        options: { actor: { allowedActors: { subject: { $in: ["service-1"] } } } },
      },
    ],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "an-actor-policy-scoped-to-the-current-actor-ignores-the-prior-ones",
    title:
      "a verifier checking only the calling actor accepts a chain whose earlier actors it does not list",
    rationale:
      "This is the specification's own reading, and it must be available: RFC 8693 §4.1 — 'Prior actors identified by any nested \"act\" claims are informational only and are not to be considered in access control decisions.' A resource asking 'is my CALLER allowed' is asking about the outermost actor alone, and holding it to the whole history would refuse every token that had ever traversed a hop the resource has no opinion about. The scope is what lets one option express both readings; without it the strict default would be the only one, and the specification-conformant deployment would have to drop the allowlist entirely.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
          act: { sub: "service-1", act: { sub: "rogue" } },
        },
      },
    ],
    when: [
      {
        step: "verify",
        options: {
          actor: { allowedActors: { subject: "service-1" }, actorScope: "current" },
        },
      },
    ],
    then: [{ step: "accepts", format: { jose: "jwt", cose: "cwt" } }],
  },
  {
    id: "an-actor-policy-scoped-to-any-actor-refuses-a-chain-in-which-none-matches",
    title:
      "a verifier requiring a named actor somewhere in the chain refuses a chain that never carried it",
    rationale:
      "The any-actor scope is an ATTESTATION — the token passed through a particular gateway at some point — and RFC 8693 §4.1 is what makes it answerable: the nested claims are 'a history trail that connects the initial request and subject through the various delegation steps'. An attestation is only worth reading if its absence refuses, and this is the scope where that is easiest to get wrong, because a search that never matches and a search that always matches both look like a check.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
          act: { sub: "rogue-1", act: { sub: "rogue-2" } },
        },
      },
    ],
    when: [
      {
        step: "verify",
        options: {
          actor: { allowedActors: { subject: "gateway" }, actorScope: "some" },
        },
      },
    ],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "an-actor-chain-deeper-than-the-stated-bound-is-refused",
    title:
      "a verifier bounding the delegation depth refuses a chain longer than it allows",
    rationale:
      "RFC 8693 §4.1 lets a chain nest without limit, and every additional hop is another party that has held the token. A depth bound is how a deployment states how far a credential may travel from the party that authorised it, and it is also the only structural bound on the claim at all — an unbounded nesting is an unbounded parse, so a verifier that never reads the depth cannot refuse a chain built purely to be expensive.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
          act: { sub: "service-1", act: { sub: "service-2", act: { sub: "service-3" } } },
        },
      },
    ],
    when: [{ step: "verify", options: { actor: { maxChainDepth: 2 } } }],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },

  // ---------------------------------------------------------------------------
  // Temporal options that must not bleed into one another.
  // ---------------------------------------------------------------------------
  {
    id: "a-freshness-bound-survives-a-waived-issued-at-range-check",
    title:
      "a token older than the caller's freshness bound is refused even when the issued-at range check was waived",
    rationale:
      "The two options bound `iat` from OPPOSITE ends. RFC 7519 §4.1.6 defines `iat` as when the token was issued, and the range check is the UPPER bound that refuses a token stamped in the future; a freshness bound is the LOWER one that refuses a token stamped too long ago. A caller accepting a future-dated token — a clock it does not control — is not thereby accepting a stale one, so folding the two into a single condition turns a narrow waiver into the removal of the bound the caller explicitly asked for in the same call.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW - 600,
          jti: "token-1",
        },
      },
    ],
    when: [{ step: "verify", options: { verifyIssuedAt: false, maxTokenAge: 300 } }],
    // The freshness bound lives in the WIRE KIT's temporal predicate, not in the
    // domain layer, so the refusal carries the kit's own namespace. The two
    // classes are the symmetric LEAF pair — `JwtError` and `CwtError` — which is
    // one rule in each wire's spelling and not two different bars.
    then: [
      { step: "rejects", on: "jose", error: "JwtError" },
      { step: "rejects", on: "cose", error: "CwtError" },
    ],
  },
  {
    id: "a-profiled-verify-honours-the-clock-tolerance-the-caller-states",
    title:
      "a profiled verify accepts a token that expired exactly as long ago as the leeway the caller allows",
    rationale:
      "RFC 7519 §4.1.4 allows 'some small leeway, usually no more than a few minutes, to account for clock skew'. The profiled call and the profile-less one are separate forwards of the same bag, so a leeway honoured by one and dropped by the other means the identical token verifies or fails depending only on whether the caller named a profile — and the direction the drop falls in is the strict one, which reads as a broken issuer rather than a broken verifier. The token here sits ON the boundary rather than comfortably inside it, so the allowance is stated as an inclusive width and not merely as a switch that was flipped.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW - CLOCK_TOLERANCE,
          iat: NOW - 3600,
          jti: "token-1",
        },
      },
    ],
    when: [
      {
        step: "verify",
        profile: "default",
        options: { audience: RESOURCE, clockTolerance: CLOCK_TOLERANCE },
      },
    ],
    then: [{ step: "accepts", format: { jose: "jwt", cose: "cwt" } }],
  },
  {
    id: "a-clock-tolerance-refuses-a-token-expired-by-more-than-it-allows",
    title:
      "a verify refuses a token that expired one second beyond the leeway the caller allows",
    rationale:
      "RFC 7519 §4.1.4 permits 'some small leeway, usually no more than a few minutes, to account for clock skew' — a bounded allowance and not a suspension of the expiry check. The MAGNITUDE is therefore the rule: a leeway applied in a unit other than the one the caller stated, or scaled on the way in, still accepts every token an honest one would and is invisible to any test that only widens the window. This row and its accepting twin sit one second apart around the same stated tolerance, so the window has exactly the width the caller asked for and a deployment allowing a minute of skew cannot be made to accept an hour of it.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW - CLOCK_TOLERANCE - 1,
          iat: NOW - 3600,
          jti: "token-1",
        },
      },
    ],
    when: [
      {
        step: "verify",
        profile: "default",
        options: { audience: RESOURCE, clockTolerance: CLOCK_TOLERANCE },
      },
    ],
    // The refusal is the wire kit's temporal predicate, so it carries that
    // wire's leaf class — the same symmetric pair the freshness bound reports.
    then: [
      { step: "rejects", on: "jose", error: "JwtError" },
      { step: "rejects", on: "cose", error: "CwtError" },
    ],
  },
  {
    id: "a-deployment-wide-clock-tolerance-applies-to-a-call-that-states-none",
    title:
      "a deployment configured with a clock tolerance applies it to a verify that states no tolerance of its own",
    rationale:
      "A deployment states its skew allowance ONCE, at construction, because it is a property of the estate's clocks and not of any one call. Every call then inherits it, and a per-call value overrides rather than replaces the mechanism. A default that is accepted and never consulted is the worst of both: the operator sees the setting in the configuration, every call behaves as though it were zero, and the resulting refusals name the token's expiry rather than the setting nobody is reading.",
    given: [
      { step: "deployment", settings: { clockTolerance: CLOCK_TOLERANCE } },
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW - CLOCK_TOLERANCE,
          iat: NOW - 3600,
          jti: "token-1",
        },
      },
    ],
    when: [{ step: "verify" }],
    then: [{ step: "accepts", format: { jose: "jwt", cose: "cwt" } }],
  },
  {
    id: "a-deployment-wide-clock-tolerance-refuses-a-token-expired-beyond-it",
    title:
      "a deployment configured with a clock tolerance refuses a token that expired one second beyond it",
    rationale:
      "A deployment-wide allowance is a WIDTH, not a switch, and the width is the whole safety property: an operator who configures a minute of skew has accepted one minute of replay after expiry and no more. A setting read in the wrong unit, or scaled, keeps accepting everything the operator intended and silently accepts far more besides, and no accepting row can tell the difference. Paired with its accepting twin one second away, this fixes the deployment default's boundary exactly where the operator put it.",
    given: [
      { step: "deployment", settings: { clockTolerance: CLOCK_TOLERANCE } },
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW - CLOCK_TOLERANCE - 1,
          iat: NOW - 3600,
          jti: "token-1",
        },
      },
    ],
    when: [{ step: "verify" }],
    then: [
      { step: "rejects", on: "jose", error: "JwtError" },
      { step: "rejects", on: "cose", error: "CwtError" },
    ],
  },

  // ---------------------------------------------------------------------------
  // The issuer pin — which keys may answer, and which `iss` is believed.
  // ---------------------------------------------------------------------------
  {
    id: "an-issuer-pin-scopes-the-key-lookup",
    title:
      "a verify pinned to an issuer refuses a token whose key is not registered under that issuer",
    rationale:
      "A `kid` is chosen by whoever wrote the token, so resolving it against every key the process knows lets the PRESENTER decide which issuer's key answers — and two issuers may legitimately publish the same `kid`, since RFC 7517 §4.5 scopes distinctness to ONE key set — 'When \"kid\" values are used within a JWK Set, different keys within the JWK Set SHOULD use distinct \"kid\" values' — and says nothing across sets. ⚠ Scoping the lookup by issuer is AEGIS POLICY, not a citation: no specification tells an implementation how to index the keys it has collected. It exists because the alternative has no safe ordering — a signature checked against a second issuer's colliding key succeeds, and the `iss` comparison that would catch it runs afterwards, by which point the verifier has already accepted material from a party the caller excluded. Refusing at RESOLUTION is what makes the caller's restriction mean 'these keys' rather than 'these keys, eventually'.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "access_token",
        content: { subject: "user-1", audience: [RESOURCE], clientId: CLIENT },
      },
    ],
    when: [
      { step: "mint" },
      {
        step: "verify",
        profile: "access_token",
        options: { audience: RESOURCE, issuer: "https://not-the-issuer/" },
      },
    ],
    then: [
      {
        step: "rejects",
        error: "AegisKeyError",
        data: { issuer: "https://not-the-issuer/" },
      },
    ],
  },
  {
    id: "a-token-whose-issuer-claim-disagrees-with-the-pinned-issuer-is-refused",
    title:
      "a token naming another issuer is refused even when its key resolves under the pinned one",
    rationale:
      "RFC 7519 §4.1.1 makes `iss` the claim that 'identifies the principal that issued the JWT', and RFC 8392 §3.1.1 gives the CWT claim the same meaning. A key registered under the pinned issuer only says the pinned issuer's material signed the bytes; the CLAIM is what the token says about who issued it, and the two can disagree — a deployment signing on behalf of a tenant, a key shared between environments. So the claim comparison is a separate check from the key scope, and skipping it once the key resolves believes the token's own account of its origin.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: "https://someone-else.lindorm.io/",
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          jti: "token-1",
          client_id: CLIENT,
        },
        options: { tokenType: "at" },
      },
    ],
    when: [
      {
        step: "verify",
        profile: "access_token",
        options: { audience: RESOURCE, issuer: ISSUER },
      },
    ],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },

  // ---------------------------------------------------------------------------
  // The profile floor, applied to a token that ARRIVED.
  // ---------------------------------------------------------------------------
  {
    id: "a-profile-refuses-a-token-typed-as-another-kind",
    title: "a token of one kind is refused when verified under the profile of another",
    rationale:
      "RFC 8725 §3.11 recommends explicit typing precisely so a token issued for one purpose cannot be replayed where another is expected, and RFC 9068 §2.1 gives the access token its own media type for that reason. Naming a profile is how a caller says which kind it expects, so the profile's own type has to be checked against the token's — otherwise an id token, which the same issuer signs with the same key, is accepted wherever an access token is demanded, and every subsequent claim check passes because the two profiles overlap.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: { subject: "user-1", audience: [RESOURCE] },
        options: { context: { accessTokenIssued: false } },
      },
    ],
    when: [
      { step: "mint" },
      { step: "verify", profile: "access_token", options: { audience: RESOURCE } },
    ],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "a-claim-a-profile-requires-is-enforced-on-arrival",
    title: "a token missing a claim its profile requires is refused when it is verified",
    rationale:
      "RFC 9068 §2.2 makes `iat` REQUIRED in a JWT access token — 'REQUIRED - as defined in Section 4.1.6 of [RFC7519]. This claim identifies the time at which the JWT access token was issued' — and RFC 8392 §3.1.6 carries the claim onto the COSE wire unchanged. A required-claim rule enforced only where THIS deployment mints constrains its own output and says nothing about the token that actually arrived, which is the only one a verifier is defending against: the issuer of a hostile token is not running our mint.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          // No `iat`. Everything else the profile requires is present, so the
          // refusal is attributable to this claim alone.
          exp: NOW + 3600,
          jti: "token-1",
          client_id: CLIENT,
        },
        options: { tokenType: "at" },
      },
    ],
    when: [{ step: "verify", profile: "access_token", options: { audience: RESOURCE } }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: {
          invalid: [{ key: "issuedAt", message: 'Required claim "issuedAt" is missing' }],
        },
      },
    ],
  },
  {
    id: "a-claim-a-profile-does-not-require-is-not-demanded-on-arrival",
    title: "a token missing a claim its profile does not require verifies",
    rationale:
      "The floor must demand exactly what the profile declares. RFC 7519 §4.1.6 makes `iat` OPTIONAL — 'Use of this claim is OPTIONAL' — so a profile written for a third party's assertion does not require it, and a floor that demanded it anyway would refuse conformant tokens from every partner while reporting a policy violation the partner cannot act on. This is the same rule as its refusing twin, read from the other side: the profile decides, not the floor.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: CLIENT,
          sub: CLIENT,
          aud: [ISSUER],
          // No `iat`, as above — and this profile declares none.
          exp: NOW + 120,
          jti: "token-1",
        },
        options: { tokenType: "delegation" },
      },
    ],
    when: [
      {
        step: "verify",
        profile: "delegation",
        options: { audience: ISSUER, issuer: CLIENT },
      },
    ],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      {
        step: "claims",
        expected: { issuer: CLIENT, subject: CLIENT, tokenId: "token-1" },
      },
    ],
  },
  {
    id: "a-required-claim-arriving-empty-is-not-supplied",
    title:
      "a token whose required claim is an empty string is refused when it is verified",
    rationale:
      'Presence has to mean the same thing at issue and on arrival. RFC 7519 §4.1.7 makes `jti` the identifier a replay check keys on, and an identifier of `""` identifies nothing — every token carrying one collides with every other, so a replay store keyed on it stops distinguishing tokens at exactly the moment it matters. A presence rule satisfied by an empty value guarantees nothing while reporting that it does.',
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: CLIENT,
          sub: CLIENT,
          aud: [ISSUER],
          exp: NOW + 120,
          iat: NOW,
          jti: "",
        },
        options: { tokenType: "delegation" },
      },
    ],
    when: [
      {
        step: "verify",
        profile: "delegation",
        options: { audience: ISSUER, issuer: CLIENT },
      },
    ],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "a-per-token-issuer-profile-verifies-against-the-issuer-it-was-minted-with",
    title:
      "a token whose issuer is stated per call round-trips under the issuer the caller named",
    rationale:
      "Most profiles issue in the deployment's own name, but an assertion made BY a client is issued by that client: RFC 7519 §4.1.1 makes `iss` 'the principal that issued the JWT', and here the principal is the caller, not the platform. So the issuer has to travel from the mint content to the wire claim and back — a mint that stamped the deployment's identity instead would produce a token the receiving party rejects for naming the wrong issuer, and it would do so silently, because the token is otherwise well-formed.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "delegation",
        content: { issuer: CLIENT, subject: "customer-sub", audience: [ISSUER] },
      },
    ],
    when: [
      { step: "mint" },
      {
        step: "verify",
        profile: "delegation",
        options: { audience: ISSUER, issuer: CLIENT },
      },
    ],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      { step: "claims", expected: { issuer: CLIENT, subject: "customer-sub" } },
    ],
  },
  {
    id: "a-profile-that-states-no-lifetime-accepts-a-token-carrying-no-expiry",
    title:
      "a security event token carrying no expiry verifies under the profile that issues it",
    rationale:
      "RFC 8417 §2.2 says of `exp` in a security event token that 'In the context of a SET, however, this notion does not typically apply, since a SET represents something that has already occurred and is historical in nature' and concludes 'Therefore, its use is NOT RECOMMENDED.' A conformant SET therefore normally carries NO expiry, while an access token with none never stops working — the same absence, opposite consequences. Expiry PRESENCE is consequently the PROFILE'S policy to state: a profile declaring a lifetime keeps the requirement, one declaring none must waive it, or this package cannot issue the shape its own specification recommends and every receiver of one refuses it.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "security_event",
        content: {
          audience: ["https://receiver.lindorm.io/"],
          subjectId: { format: "iss_sub", iss: ISSUER, sub: "user-1" },
          events: { "urn:lindorm:event:test": {} },
        },
      },
    ],
    when: [
      { step: "mint" },
      {
        step: "verify",
        profile: "security_event",
        options: { audience: "https://receiver.lindorm.io/" },
      },
    ],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      // The subject identifier is read back under its DOMAIN name, which is what
      // shows the profile is usable and not merely acceptable: RFC 9493 §3 makes
      // `sub_id` a structured Subject Identifier, and it is the whole statement
      // of who a security event happened to.
      //
      // ⚠ Its neighbour `events` is NOT stated here: `DomainClaims` does not
      // carry the name — the type comment says `events` keeps its wire key and
      // is not part of the set — so the expectation would not compile even
      // though the claim reaches the bucket at runtime. The wire-side statement
      // about `events` is `an-event-payload-survives-the-empty-claim-prune`.
      {
        step: "claims",
        expected: { subjectId: { format: "iss_sub", iss: ISSUER, sub: "user-1" } },
      },
      // ⚠ The row's PREMISE, read off the wire. The verify this row runs sets
      // `expPresence: "optional"`, so a token that DID carry an expiry would
      // pass identically and the row would state nothing about the profile's
      // lifetime at all. RFC 8392 §3.1.4 gives `exp` the COSE label 4.
      { step: "wireClaims", on: "jose", excludes: ["exp"] },
      { step: "wireClaims", on: "cose", excludes: [4] },
    ],
  },

  // ---------------------------------------------------------------------------
  // The algorithm-class floor — what a valid signature PROVES.
  //
  // Both rows put a token written by a FOREIGN producer in front of the floor,
  // because aegis cannot build one: the same class constraint is part of the
  // SIGNING floor, so mint never selects a shared secret for these profiles and
  // a mint-built fixture could not reach the rule at all.
  // ---------------------------------------------------------------------------
  {
    id: "a-profile-demanding-an-asymmetric-signature-refuses-a-shared-secret",
    title:
      "a token authenticated with a shared secret is refused by a profile that requires a signature",
    rationale:
      "A MAC proves that SOMEBODY holding the secret produced the token, and every party that can verify holds it — so a shared secret cannot establish who issued anything. An access token is presented to a party that is not the issuer, which is exactly the case the distinction exists for. RFC 8725 §3.1 makes the restriction the verifier's to state: 'Libraries MUST enable the caller to specify a supported set of algorithms and MUST NOT use any other algorithms when performing cryptographic operations.' The rule must bite on ARRIVAL, because a constraint applied only where this deployment signs defends nobody against a token this deployment did not write.",
    given: [
      { step: "keys", keys: ["oct-sig"] },
      {
        step: "token",
        via: "foreign",
        key: "oct-sig",
        typ: { jose: "application/at+jwt", cose: "application/at+cwt" },
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          jti: "forged-1",
          client_id: CLIENT,
        },
      },
    ],
    when: [{ step: "verify", profile: "access_token", options: { audience: RESOURCE } }],
    // The `data` pins the algorithm the refusal READ, so it is attributable to
    // the class floor and not to any other rule this token would also have to
    // satisfy. It is the same on both wires — one rule, one spelling.
    then: [{ step: "rejects", error: "AegisDomainError", data: { algorithm: "HS256" } }],
  },
  {
    id: "a-third-party-access-token-authenticated-with-a-shared-secret-is-refused",
    title:
      "a third-party access token authenticated with a shared secret is refused by the profile written to accept it",
    rationale:
      "RFC 7515 §1 secures content 'with digital signatures or Message Authentication Codes (MACs)', and the two say different things about origin: everyone who can VERIFY a MAC can also PRODUCE one, so a MAC establishes only that some holder of the secret wrote the token. A profile whose whole purpose is to accept tokens from an authorization server we do not control is the case where that matters most — the deployment holds the same secret it would be relying on to prove the third party issued the token, so it could equally have written it itself. RFC 8725 §3.1 makes the restriction the verifier's to state and to enforce: 'Libraries MUST enable the caller to specify a supported set of algorithms and MUST NOT use any other algorithms when performing cryptographic operations.'",
    given: [
      { step: "keys", keys: ["oct-sig"] },
      {
        step: "token",
        via: "foreign",
        key: "oct-sig",
        typ: { jose: "application/at+jwt", cose: "application/at+cwt" },
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          exp: NOW + 3600,
          iat: NOW,
          jti: "forged-1",
        },
      },
    ],
    when: [
      {
        step: "verify",
        profile: "external_access_token",
        options: { audience: RESOURCE, issuer: ISSUER },
      },
    ],
    then: [{ step: "rejects", error: "AegisDomainError", data: { algorithm: "HS256" } }],
  },
  {
    id: "a-delegation-designation-authenticated-with-a-shared-secret-is-refused",
    title:
      "a delegation designation authenticated with a shared secret is refused by its profile",
    rationale:
      "A delegation designation names the client that issued it as its own `iss`, so the platform receiving it is being asked to act on an attribution. RFC 7515 §1 secures content 'with digital signatures or Message Authentication Codes (MACs)', and a MAC is symmetric: the receiving platform holds the same secret and could have written the designation itself, so the attribution it carries is unfalsifiable and therefore worthless. Only a signature made by the client's own registered key lets the platform say who designated whom. RFC 8725 §3.1 puts the restriction where it must be enforced: 'Libraries MUST enable the caller to specify a supported set of algorithms and MUST NOT use any other algorithms when performing cryptographic operations.'",
    given: [
      { step: "keys", keys: ["oct-sig"] },
      {
        step: "token",
        via: "foreign",
        key: "oct-sig",
        typ: {
          jose: "application/delegation+jwt",
          cose: "application/delegation+cwt",
        },
        claims: {
          iss: CLIENT,
          sub: CLIENT,
          aud: [ISSUER],
          exp: NOW + 120,
          iat: NOW,
          jti: "forged-2",
        },
      },
    ],
    when: [
      {
        step: "verify",
        profile: "delegation",
        options: { audience: ISSUER, issuer: CLIENT },
      },
    ],
    then: [{ step: "rejects", error: "AegisDomainError", data: { algorithm: "HS256" } }],
  },
  {
    id: "a-profile-that-states-no-algorithm-class-accepts-a-shared-secret",
    title:
      "a token authenticated with a shared secret verifies under a profile that requires no signature",
    rationale:
      "The class floor is the PROFILE'S rule and not a blanket ban, and the difference is load-bearing. RFC 8417 §5.1 requires only that a security event token be authenticated — 'Unless integrity of the JWT is ensured by other means, it MUST be signed using JWS [RFC7515] by an issuer that is trusted to do so for the use case so that the SET can be authenticated and validated by the SET recipient' — and constrains the ALGORITHM nowhere, while RFC 7515 §1 defines a JWS as content secured with digital signatures OR Message Authentication Codes. A SET is delivered to a receiver the transmitter already has a relationship with, so a shared secret is a conformant and ordinary choice there. A floor applied to every profile would refuse it, and the remedy a deployment reaches for is to stop using the profile — which discards every other rule it carried along with the one that was wrong.",
    given: [
      { step: "keys", keys: ["oct-sig"] },
      {
        step: "token",
        via: "foreign",
        key: "oct-sig",
        typ: { jose: "application/secevent+jwt", cose: "application/secevent+cwt" },
        claims: {
          iss: ISSUER,
          aud: ["https://receiver.lindorm.io/"],
          iat: NOW,
          jti: "set-1",
          sub_id: { format: "iss_sub", iss: ISSUER, sub: "user-1" },
          events: { "urn:lindorm:event:test": {} },
        },
      },
    ],
    when: [
      {
        step: "verify",
        profile: "security_event",
        options: { audience: "https://receiver.lindorm.io/" },
      },
    ],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwm" } },
      { step: "claims", expected: { issuer: ISSUER } },
    ],
  },

  // ---------------------------------------------------------------------------
  // The wire form of a date-valued claim.
  // ---------------------------------------------------------------------------
  {
    id: "a-date-valued-claim-travels-the-wire-as-a-count-of-seconds",
    title:
      "a claim a caller states as an instant reaches the wire as a number of seconds",
    rationale:
      "OIDC Core §2 defines `auth_time` as the 'Time when the End-User authentication occurred. Its value is a JSON number representing the number of seconds from 1970-01-01T00:00:00Z as measured in UTC until the date/time.' The DOMAIN shape of such a claim is an instant and its WIRE shape is that number, so the encoder is what stands between them — and it fails in the one direction nothing reports: a value it does not recognise as an instant encodes to nothing, which drops the claim from the token without an error, so the issuer believes it stated an authentication time and the audience receives none.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: {
          subject: "user-1",
          audience: [CLIENT],
          // ⚠ LOCAL cast, deliberate: the content type declares a `Date` and a
          // row carries only JSON, so the instant is a date CELL the interpreter
          // revives. The cast is what the two spellings cost; nothing about the
          // NAME is weakened, since a misspelled key still fails to compile.
          authTime: { date: "2024-01-01T07:30:00.000Z" } as unknown as Date,
        },
        options: { context: { accessTokenIssued: false } },
      },
    ],
    when: [{ step: "mint" }],
    // Read through the INDEPENDENT inspector, and the same on both wires: the
    // claim has no registered CWT integer label, so it rides COSE under its
    // registered string name, and the VALUE is the number either way.
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      { step: "wireClaims", includes: { auth_time: NOW - 1800 } },
    ],
  },

  // ---------------------------------------------------------------------------
  // The STATIC claim matcher — verify's claim checking without the signature.
  //
  // It is a public surface of its own (`Aegis.assert` / `Aegis.matches`), reached
  // with a flat claim dict that arrived some other way: an introspection
  // response, a cached credential, a claim set already verified upstream. Every
  // rule below is one a caller would otherwise hand-roll, and a hand-rolled
  // version of any of them disagrees with the verified arm at the boundary.
  // ---------------------------------------------------------------------------
  {
    id: "a-scalar-matcher-against-an-array-valued-claim-asks-for-containment",
    title:
      "a caller asserting one value of a list-valued claim is answered by a claim containing it",
    rationale:
      "Several registered claims are LISTS: RFC 7519 §4.1.3 makes an array of strings the general form of `aud`, and RFC 8693 §4.2 defines `scope` as 'a JSON string containing a space-separated list of scopes associated with the token' — the authorisation claims beside it follow the same shape. A caller naming ONE value of such a claim is asking whether the list contains it, which is the only question a single identity can pose: it never expects the list to consist of that value alone. A matcher compiled to an equality test answers `false` for every such claim, so the whole family becomes unassertable at once — and these are the claims authorisation is decided on.",
    given: [{ step: "claims", claims: { ...LIST_CLAIMS } }],
    when: [{ step: "static-assert", assert: { ...LIST_CLAIM_MATCHERS } }],
    then: [{ step: "accepts" }],
  },
  {
    id: "a-scalar-matcher-an-array-valued-claim-does-not-contain-is-refused",
    title: "a caller asserting a value a list-valued claim does not carry is refused",
    rationale:
      "Containment that never fails is not containment. These are the claims authorisation decisions are made on — scopes, roles, permissions, entitlements — so a matcher over them that accepts every list grants every request it was written to gate, and it does so at the one call site the deployment believes is doing the gating.",
    given: [{ step: "claims", claims: { ...LIST_CLAIMS } }],
    when: [
      {
        step: "static-assert",
        assert: {
          audience: "not-carried",
          scope: "not-carried",
          authMethods: "not-carried",
          roles: "not-carried",
          permissions: "not-carried",
          groups: "not-carried",
          entitlements: "not-carried",
        },
      },
    ],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "an-array-matcher-against-a-list-valued-claim-demands-every-value-it-lists",
    title:
      "a caller asserting several values of a list-valued claim is answered when the claim carries them all",
    rationale:
      "A caller naming several values is stating a conjunction — this operation needs BOTH scopes — because the alternative reading is already available as an explicit any-of condition. Choosing conjunction as the bare-array meaning is what makes the common case safe by default: an implicit any-of would grant an operation to a token carrying only the weakest of the scopes the caller listed, and the call site would look identical.",
    given: [{ step: "claims", claims: { scope: ["openid", "profile"] } }],
    when: [{ step: "static-assert", assert: { scope: ["openid", "profile"] } }],
    then: [{ step: "accepts" }],
  },
  {
    id: "an-array-matcher-listing-a-value-the-claim-lacks-is-refused",
    title:
      "a caller asserting several values is refused by a claim carrying only some of them",
    rationale:
      "The refusing half is what makes the conjunction real. A partial match accepted here is the any-of reading arriving by accident, and it arrives silently: the accepting case passes either way, so nothing but this distinguishes the two meanings — and the difference between them is whether a token holding one scope may perform an operation that requires two.",
    given: [{ step: "claims", claims: { scope: ["openid"] } }],
    when: [{ step: "static-assert", assert: { scope: ["openid", "profile"] } }],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "a-condition-supplied-as-a-matcher-is-evaluated-verbatim",
    title:
      "a caller bounding a numeric claim with a comparison is refused by a value below the bound",
    rationale:
      "A bare value is sugar for a condition, so the condition itself must pass through untouched — otherwise the sugar is the whole surface and anything it cannot express is unreachable. The refusing direction is the one to pin, because an unevaluated condition object compares as a VALUE against the claim, and no claim equals an object: the failure would then be that everything is refused, which is loud, or that the branch is skipped entirely, which is silent and accepts everything.",
    given: [{ step: "claims", claims: { levelOfAssurance: 1 } }],
    when: [{ step: "static-assert", assert: { levelOfAssurance: { $gte: 2 } } }],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "a-failing-claim-assertion-names-every-claim-that-failed",
    title: "an assertion that fails on several claims names all of them",
    rationale:
      "The caller of a claim check is deciding what to tell its own caller and what to log, and both answers depend on WHICH requirements were not met. Reporting the first failure alone turns one round trip into as many as there are failing claims, and in an authorisation path those round trips are a user retrying a request that was never going to succeed.",
    given: [
      {
        step: "claims",
        claims: { audience: ["https://other.lindorm.io/"], subject: "user-1" },
      },
    ],
    when: [
      {
        step: "static-assert",
        assert: { audience: RESOURCE, subject: "someone-else" },
      },
    ],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: { invalid: ["audience", "subject"] },
      },
    ],
  },
  {
    id: "the-static-claim-matcher-derives-no-hash-from-a-raw-source",
    title: "a raw hash source presented to the static claim matcher matches nothing",
    rationale:
      "OIDC Core §3.1.3.6 derives `at_hash` with the hash function selected by the token's signing `alg`, and `alg` is a HEADER parameter. This surface is handed a flat claim dict with no header, so it cannot know which function to apply — a surface that guessed would produce a digest that matches for one algorithm and silently fails for every other, which is indistinguishable from a substituted access token. The division is therefore structural, not an omission: the key-holding verify derives, and this one matches the digest mint already wrote.",
    given: [{ step: "claims", claims: { accessTokenHash: "a-digest" } }],
    when: [
      {
        step: "static-assert",
        // ⚠ LOCAL cast, deliberate: `DomainAssert` offers no raw-source matcher,
        // which is the TYPE-level half of this same rule. The cast is what lets
        // the row state the RUNTIME half, for a caller reaching the API from
        // untyped code.
        assert: { accessToken: AT_SOURCE } as unknown as DomainAssert,
      },
    ],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },

  // ---------------------------------------------------------------------------
  // The static matcher's TEMPORAL WINDOW — the same bounds a verify applies,
  // over a claim set whose signature was checked somewhere else.
  // ---------------------------------------------------------------------------
  {
    id: "the-static-claim-matcher-applies-the-expiry-window-with-no-temporal-matcher",
    title:
      "an expired claim set is refused even when the caller asserts nothing about time",
    rationale:
      "RFC 7519 §4.1.4 defines `exp` as the instant 'on or after which the JWT MUST NOT be accepted for processing', and that obligation belongs to whoever is processing the claims — it does not lapse because the signature was checked upstream. Applying the bound by DEFAULT is what retires the hand-rolled `exp > now` a caller would otherwise write, and a hand-rolled one carries no clock tolerance, so a claim set inside the verified arm's skew window passes there and fails here.",
    given: [
      {
        step: "claims",
        claims: {
          subject: "user-1",
          expiresAt: { date: "2024-01-01T07:00:00.000Z" },
        },
      },
    ],
    when: [{ step: "static-assert", assert: { subject: "user-1" } }],
    // The `data` names the claim the refusal READ, so it is attributable to the
    // temporal window rather than to the matcher the caller did state.
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: { invalid: ["expiresAt"] },
      },
    ],
  },
  {
    id: "a-claim-set-that-states-no-expiry-is-not-treated-as-expired",
    title: "a claim set carrying no expiry passes the temporal window",
    rationale:
      "RFC 7519 §4.1.4 says of `exp` that 'Use of this claim is OPTIONAL', and RFC 8417 §2.2 puts a whole class of conformant tokens on the other side of that: in a security event token 'this notion does not typically apply, since a SET represents something that has already occurred and is historical in nature. Therefore, its use is NOT RECOMMENDED.' A RANGE bound that treated an absent claim as a failed one would refuse every such claim set — and would report the refusal as an expiry, which points whoever reads it at a clock rather than at a claim that was never there. Whether the claim must be PRESENT is a different question, and it is answered by a different policy.",
    given: [{ step: "claims", claims: { subject: "user-1" } }],
    when: [{ step: "static-assert", assert: { subject: "user-1" } }],
    then: [{ step: "accepts" }],
  },
  {
    id: "the-static-claim-matcher-honours-a-waived-expiry-range-check",
    title: "an expired claim set is accepted when the caller waives the expiry range",
    rationale:
      "The waiver has the same narrow purpose here as on the verified arm — inspecting a claim set whose lifetime is not what is being trusted — and the two surfaces must offer it identically, or a caller migrating a check from one to the other silently changes the answer. An option accepted and dropped is the worst shape for it: nothing raises, and the caller concludes the claim set was live.",
    given: [
      {
        step: "claims",
        claims: {
          subject: "user-1",
          expiresAt: { date: "2024-01-01T07:00:00.000Z" },
        },
      },
    ],
    when: [
      {
        step: "static-assert",
        assert: { subject: "user-1" },
        options: { verifyExpiration: false },
      },
    ],
    then: [{ step: "accepts" }],
  },
  {
    id: "the-static-claim-matcher-honours-a-caller-supplied-clock-tolerance",
    title: "a claim set expired inside the leeway the caller allows is accepted",
    rationale:
      "RFC 7519 §4.1.4 provides for 'some small leeway, usually no more than a few minutes, to account for clock skew'. The leeway is the deployment's to choose and it is the reason this surface applies the window at all rather than leaving it to the caller: a hand-rolled comparison has no leeway, so the two arms disagree for exactly the claim sets skew produces — the ones that arrive at the boundary of the window, intermittently, in production.",
    given: [
      { step: "clock", at: "2024-01-01T09:00:10.000Z" },
      {
        step: "claims",
        claims: { subject: "user-1", expiresAt: { date: EXPIRES_AT } },
      },
    ],
    when: [
      {
        step: "static-assert",
        assert: { subject: "user-1" },
        options: { clockTolerance: 60 },
      },
    ],
    then: [{ step: "accepts" }],
  },
  {
    id: "the-static-claim-matcher-judges-against-a-caller-supplied-instant",
    title:
      "a claim set is judged against the instant the caller names rather than the wall clock",
    rationale:
      "Every temporal bound is a comparison against an instant, and the instant is an INPUT: a caller replaying a stored claim set, reconstructing what a decision looked like at the time it was made, or testing one, states the moment it means. Substituting the wall clock answers a different question than the one asked, and it is wrong in the permissive direction as readily as the strict one — a claim set long expired is judged live if the caller's instant is ignored in the other direction.",
    given: [
      { step: "clock", at: "2024-01-01T12:00:00.000Z" },
      {
        step: "claims",
        claims: { subject: "user-1", expiresAt: { date: EXPIRES_AT } },
      },
    ],
    when: [
      {
        step: "static-assert",
        assert: { subject: "user-1" },
        options: { currentDate: { date: "2024-01-01T08:00:00.000Z" } as unknown as Date },
      },
    ],
    then: [{ step: "accepts" }],
  },
  {
    id: "the-static-claim-matcher-applies-the-not-before-bound",
    title: "a claim set that is not yet valid is refused",
    rationale:
      "RFC 7519 §4.1.5 — 'the JWT MUST NOT be accepted for processing' before the time `nbf` names. It is a hard lower bound and it is the one most often left out of a hand-rolled check, because the credential looks complete and its expiry has not passed; a claim set issued for a future window is then honoured for the whole interval before that window opens.",
    given: [
      {
        step: "claims",
        claims: {
          subject: "user-1",
          expiresAt: { date: EXPIRES_AT },
          notBefore: { date: "2024-01-01T08:30:00.000Z" },
        },
      },
    ],
    when: [{ step: "static-assert", assert: { subject: "user-1" } }],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "the-static-claim-matcher-honours-a-waived-not-before-bound",
    title:
      "a claim set that is not yet valid is accepted when the caller waives that bound",
    rationale:
      "Each waiver names exactly one bound, so each has to be read on its own. A forward that enumerates the option bag by hand can carry one flag and drop the next, and the two failures are indistinguishable from the call site: the caller states two waivers, gets one, and sees a refusal that names a claim it thought it had already excused.",
    given: [
      {
        step: "claims",
        claims: {
          subject: "user-1",
          expiresAt: { date: EXPIRES_AT },
          notBefore: { date: "2024-01-01T08:30:00.000Z" },
        },
      },
    ],
    when: [
      {
        step: "static-assert",
        assert: { subject: "user-1" },
        options: { verifyNotBefore: false },
      },
    ],
    then: [{ step: "accepts" }],
  },
  {
    id: "the-static-claim-matcher-applies-an-authentication-time-bound-on-request",
    title:
      "a claim set whose authentication time lies in the future is refused when the caller asks for that bound",
    rationale:
      "OIDC Core §2 defines `auth_time` as the 'Time when the End-User authentication occurred', so a value in the future describes an authentication that has not happened — a claim set no honest issuer produces. It is checked ON REQUEST rather than always because, unlike `exp` and `nbf`, the claim carries no processing obligation of its own: it is an input to a relying party's freshness policy, and a party that states no such policy has not asked for anything to be enforced.",
    given: [
      {
        step: "claims",
        claims: {
          subject: "user-1",
          expiresAt: { date: EXPIRES_AT },
          authTime: { date: "2024-01-01T08:30:00.000Z" },
        },
      },
    ],
    when: [
      {
        step: "static-assert",
        assert: { subject: "user-1" },
        options: { verifyAuthTime: true },
      },
    ],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "a-static-freshness-bound-refuses-a-claim-set-older-than-it-allows",
    title: "a claim set issued longer ago than the caller allows is refused",
    rationale:
      "OIDC Core §3.1.2.1 gives a relying party `max_age` and §3.1.3.7 requires it to check freshness on the way back; the same bound applies to a claim set read out of a cache or an introspection response, where the age is the only thing separating a current answer from a stale one. It is a TIGHTENING option — it can only refuse claim sets that would otherwise pass — so dropping it is always the unsafe direction, and it leaves no trace: a stale claim set passing looks exactly like a fresh one.",
    given: [
      { step: "clock", at: "2024-01-01T08:30:00.000Z" },
      {
        step: "claims",
        claims: {
          subject: "user-1",
          expiresAt: { date: EXPIRES_AT },
          issuedAt: { date: "2024-01-01T08:00:00.000Z" },
        },
      },
    ],
    when: [
      {
        step: "static-assert",
        assert: { subject: "user-1" },
        options: { maxTokenAge: 600 },
      },
    ],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "a-static-freshness-bound-refuses-a-claim-set-that-states-no-issuance-instant",
    title:
      "a claim set carrying no issuance instant is refused when the caller bounds its age",
    rationale:
      "RFC 7519 §4.1.6 makes `iat` OPTIONAL, so a claim set may legitimately carry none — and a freshness bound cannot be evaluated against a claim that is absent. The bound must therefore fail CLOSED: treating an unstated issuance as satisfying every age limit means the way to defeat the bound is to omit the claim, which is the one thing the party presenting the claim set can always do.",
    given: [
      {
        step: "claims",
        claims: { subject: "user-1", expiresAt: { date: EXPIRES_AT } },
      },
    ],
    when: [
      {
        step: "static-assert",
        assert: { subject: "user-1" },
        options: { maxTokenAge: 600 },
      },
    ],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "an-explicit-temporal-matcher-replaces-the-range-bound-it-names",
    title:
      "a caller stating its own bound on a temporal claim is answered by that bound alone",
    rationale:
      "The default window is a convenience, not a policy the caller cannot address. A caller asking a different question about the same claim — was this set live at a particular moment, does it expire before some deadline — must get the question it asked, so its own matcher replaces the default bound rather than being conjoined with it. Conjoining them would make the explicit matcher unable to widen anything, which is exactly the direction such a question usually goes, and the caller would have no way to tell the two bounds apart in the refusal.",
    given: [
      {
        step: "claims",
        claims: {
          subject: "user-1",
          expiresAt: { date: "2024-01-01T07:00:00.000Z" },
        },
      },
    ],
    when: [
      {
        step: "static-assert",
        assert: { expiresAt: { $lte: { date: EXPIRES_AT } } } as unknown as DomainAssert,
      },
    ],
    then: [{ step: "accepts" }],
  },
];
