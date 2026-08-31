import type { Dict } from "@lindorm/types";
import type { AegisProfile } from "../types/claims/domain/aegis-profile.js";
import type { AegisSensitive } from "../types/claims/domain/aegis-sensitive.js";
import type { DomainClaims } from "../types/claims/domain/domain-claims.js";
import type { BuiltInProfiles } from "../internal/profiles/built-in-profiles.js";
import type {
  ActClaimWire,
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
  PolicyRule,
  ProfileContent,
  ProfileMintOptions,
  SignContent,
  TokenProfileInput,
  SignContext,
  ProfileVerifyOptions,
  RawSignInput,
  CoseSignStructuredTokenOptions,
  CoseSignUnstructuredTokenOptions,
  JoseSignStructuredTokenOptions,
  JoseSignUnstructuredTokenOptions,
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
 *     {@link Scenario.knownDefect} (per wire where the shortfall is per wire) and
 *     reported. The code is repaired later; the row is not touched now.
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
 * catches, so it is the class the package owes at every door. `TypeError` is the
 * class a malformed matcher bag throws as itself: `@lindorm/match`'s refusal of
 * the shape, not an aegis verdict about the token.
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
  | "LindormError"
  | "TypeError";

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
// together or not at all. A wire-PINNED row takes its own wire's type; an
// AGNOSTIC row takes the {@link Agnostic} form of the COSE one.

/**
 * The custom bag a WIRE-AGNOSTIC row states — ONE convention, the same one the
 * agnostic `kit: "structured"` step states for claims: the row is written in the
 * JOSE spelling and the interpreter re-spells for COSE
 * (`run-scenario.ts#coseCustomOf`). JOSE names its ONE header `header`, COSE names
 * a bucket for the integrity that covers it
 * (`src/types/header/wire-envelope.ts#export type JoseWireTokenEnvelope`).
 *
 * ⚠ `unprotected` is COSE-ONLY and is NOT re-spelled — there is no JOSE bucket to
 * re-spell it to. A row stating it must scope itself `unsupported: { jose: … }`;
 * on a JOSE run the interpreter THROWS rather than signing a token that ignores
 * half the row (`run-scenario.ts#joseOptionsOf`).
 */
export type AgnosticCustom = {
  header?: Record<string, unknown>;
  unprotected?: Record<string, unknown>;
};

/**
 * A wire-agnostic row's options: its COSE kit's OWN bag with the custom bucket
 * re-spelled and the COSE-only `proprietary` REMOVED. Derived from the kit type
 * rather than restated, so a new kit option reaches the agnostic rows without an
 * edit here.
 *
 * ⚠ THE TWO COSE-ONLY MEMBERS GET DIFFERENT ANSWERS, because they are in
 * different situations. `proprietary` is omitted OUTRIGHT — no agnostic row needs
 * it, and the JOSE kits read it nowhere
 * (`src/internal/wire/jose-token-wire.ts#is a COSE interop gate the JOSE kits ignore`),
 * so an agnostic row stating it would be honoured on COSE and silently ignored on
 * JOSE. Removing it makes that a COMPILE error, the
 * same way the registered `header` bag is CLOSED so a typo cannot ride the wire;
 * a row that genuinely needs the knob pins to `cwt`/`cws`/`cwe`. `unprotected`
 * STAYS on {@link AgnosticCustom}, because a real row does state it — paired with
 * `unsupported: { jose: … }` — and the JOSE leg refuses it at run time
 * (`run-scenario.ts#joseOptionsOf`) rather than dropping it.
 */
type Agnostic<T> = Omit<T, "custom" | "proprietary"> & { custom?: AgnosticCustom };

export type StructuredSignOptions = Agnostic<CoseSignStructuredTokenOptions> & {
  key?: AegisSignKey;
};
export type OpaqueSignOptions = Agnostic<CoseSignUnstructuredTokenOptions> & {
  key?: AegisSignKey;
};
export type SealedSealOptions = Agnostic<CweEncryptOptions> & { key?: AegisEncKey };
export type JwtSignOptions = JoseSignStructuredTokenOptions & { key?: AegisSignKey };
export type CwtSignOptions = CoseSignStructuredTokenOptions & { key?: AegisSignKey };
export type JwsSignOptions = JoseSignUnstructuredTokenOptions & { key?: AegisSignKey };
export type CwsSignOptions = CoseSignUnstructuredTokenOptions & { key?: AegisSignKey };
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
  settings: Pick<AegisSettings, "clockTolerance" | "dpopMaxSkew" | "partyRecipient">;
};

/**
 * The content type of each profile a row REGISTERS through a {@link
 * ProfileGivenStep} — the fixture's own half of `ProfileContent`, which covers
 * the built-ins alone.
 *
 * ⚠ Declared, never inferred. `registerProfile` takes a runtime descriptor, so
 * the compiler cannot derive a content type from one; writing it here is what
 * keeps a registered profile's rows held to the same standard as a built-in's,
 * instead of `string` reopening the fall-through `ProfileContentFor` was written
 * to close (a built-in name matching an open member and compiling as the whole
 * `SignContent` vocabulary).
 *
 * `sender_constrained` is the smallest profile that DEMANDS a proof-of-
 * possession binding. No built-in requires `confirmation`, so the capability that
 * a demanded binding must actually bind cannot be stated against one.
 *
 * `scoped_access` is the smallest profile that DEMANDS a `scope`. No built-in
 * requires one, so which refusal a demanded scope with a malformed member meets
 * cannot be stated against one.
 */
type RegisteredProfileContent = {
  sender_constrained: Required<
    Pick<SignContent, "subject" | "audience" | "confirmation">
  >;
  scoped_access: Required<Pick<SignContent, "subject" | "audience" | "scope">>;
};

/**
 * The `mint` construction, one member per profile so `profile` and `content` are
 * correlated: naming `access_token` holds the content to `AccessTokenContent`
 * and a claim that profile does not admit fails the build.
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

type MintableProfiles = ProfileContent & RegisteredProfileContent;

export type MintGivenStep = {
  [P in keyof MintableProfiles]: {
    step: "token";
    via: "mint";
    profile: P;
    content: MintContent<MintableProfiles[P]>;
    options?: ProfileMintOptions;
  };
}[keyof MintableProfiles];

/**
 * The part of a built artifact a {@link TamperGiven} rewrites.
 *
 * The three are the three parts of a serialised token, and they are named
 * separately because a caller's mental model of "the token was modified" covers
 * all three while only one of them is the signature itself. On both wires the
 * protected header and the payload are the integrity computation's inputs and the
 * signature is its output (RFC 7515 §5.2, RFC 9052 §4.4), so a rewrite of any of
 * the three is refused.
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
 * Extra header parameters a FOREIGN producer writes, stated in the JOSE wire
 * vocabulary (`typ`, `cty`, `oid`, `crit`, …).
 *
 * It exists because aegis's own writers deliberately cannot produce these
 * shapes: a caller `typ` is kit-derived, a REGISTERED parameter has no
 * caller-chosen bucket (`header` is the one bag that takes one and it travels
 * protected), and a `crit` naming a specification-defined parameter is refused at
 * the mint gate. So the only way to state what a READER must do with one is to
 * have somebody else write it.
 *
 * ⚠ THE TWO FIELDS HAVE DIFFERENT REACH, and the split is the serialisation's,
 * not a convention:
 *   - `protectedHeader` applies on BOTH wires: "the integrity-protected header"
 *     names something on each (RFC 7515 §7.1, RFC 9052 §3).
 *   - `unprotectedHeader` is COSE ONLY — JOSE has no second bucket for it — and a
 *     row naming it owes the JOSE wire an `unsupported` reason. The interpreter
 *     refuses it there rather than signing a token that silently drops half the
 *     row.
 *
 * ⚠ HOW A NAME REACHES THE WIRE differs per wire, and both go through aegis's own
 * registry where it answers. On JOSE the name IS the key. On COSE it is written
 * at the integer label the registry gives it — deliberately, since the point of
 * placing a parameter is to put it exactly where aegis WOULD read it from, and a
 * hand-picked label the reader ignores makes a row pass for the wrong reason. A
 * name the registry does not know at all falls back to its TEXT label
 * (RFC 9052 §1.5); that is how a third party's own extension parameter actually
 * travels, and it is the only way to state a rule about one.
 *
 * ⚠ `unprotectedHeader` entries are written AFTER the producer's own derived
 * `kid`, which is the routing hint aegis's COSE key resolution reads.
 */
export type ForeignHeadersGiven = {
  protectedHeader?: Dict;
  unprotectedHeader?: Dict;
  /**
   * COSE ONLY — protected entries written under their TEXT label, whatever the
   * registry says, where `protectedHeader` above deliberately resolves a
   * registered name to its integer one. The integer 2 and the text `"crit"` are
   * different labels (RFC 9052 §1.5).
   *
   * ⭐ IT EXISTS TO STATE ONE THING NO OTHER CELL CAN: a bucket carrying BOTH
   * forms of the same parameter. That is a shape aegis's own writers cannot
   * produce and a `Dict` cannot express through `protectedHeader` alone (one
   * key, one label), and it is where a reader has to decide WHICH form answers
   * for the name — the question
   * `a-text-label-cannot-impersonate-a-registered-header-parameter` is about.
   */
  textLabelledProtected?: Dict;
};

/**
 * WHAT SECURES A FORGED TOKEN — a {@link KeyFixture} the vault holds, or `"junk"`
 * for bytes that are not a signature at all.
 *
 * ⚠ REQUIRED, and the two answers reach DIFFERENT DOORS. `"junk"` states a token
 * nobody could have signed, which is the whole reach of `aegis.parse`: it reports
 * a payload WITHOUT checking a signature, so an attacker needs no key. A key
 * fixture states a token that genuinely VERIFIES, which is the only way to put a
 * hostile shape past the signature check and in front of the claims layer. A
 * default here would silently decide which of the two a row was about.
 */
export type ForgedSignature = "junk" | KeyFixture;

/**
 * HOW A FORGED COSE MEMBER IS KEYED — an integer label or a text one, as a cell
 * (RFC 9052 §1.5).
 *
 * ⚠ IT IS NOT REDUNDANT WITH THE KEY'S OWN TYPE, and that is the point of
 * spelling {@link ForgedMember.key} as a string. A Gherkin data table cell is
 * text and has no integer type at all, so in the medium this row exists to become
 * (`| key | keyedBy | value |`) the `2` in a cell is a string either way and this
 * column is the ONLY thing that says whether it means the integer label 2 or the
 * one-character text label `"2"`. CBOR keys those apart, and conflating them is
 * exactly the class of mistake a forged row exists to catch.
 */
export type ForgedKeying = "label" | "name";

/**
 * What a forged member CARRIES. Any JSON value — there is no vocabulary to check
 * a hostile value against.
 *
 * ⚠ Held as the REAL value here and rendered as JSON text in a Gherkin cell, so
 * the migration is `JSON.stringify` per cell. The alternative — JSON text in the
 * row too — would make this the one column in the whole table whose values are
 * quoted strings of themselves.
 */
export type ForgedValue =
  | string
  | number
  | boolean
  | null
  | Dict
  | ReadonlyArray<unknown>;

/**
 * ONE MEMBER of a forged COSE claim map: its key, how that key is keyed, and what
 * it carries.
 *
 * ⭐⭐ A LIST OF THESE IS WHAT A JS OBJECT CANNOT BE. It has ROWS, so one member
 * may appear TWICE — once at its integer label and once under its interoperable
 * text name — which is a legal CBOR map and an impossible object literal. That
 * single property is the whole reason a forged token states a list and not a bag.
 */
export type ForgedMember = {
  key: string;
  keyedBy: ForgedKeying;
  value: ForgedValue;
};

/**
 * The claim a forged COSE member table is written INTO, in the DOMAIN
 * vocabulary. The interpreter resolves its COSE wire key from the claim registry
 * — never hand-listed, for the same reason `respellForCose` is derived.
 */
export type ForgedClaim = keyof DomainClaims;

/**
 * The `aegis.sign` knobs a row may state — the whole `RawSignInput` surface minus
 * the two the step owns: `payload` (the row's own `claims`/`content`) and
 * `format` (the run's wire chooses it, which is what keeps a row agnostic).
 *
 * ⚠ DERIVED from the real input type rather than re-listed, so a knob added to
 * the verb is expressible here the same day and a knob removed stops compiling.
 */
export type DomainSignOptions = Omit<RawSignInput, "payload" | "format">;

/**
 * How the artifact under test comes into existence, discriminated by `via`.
 *
 * - `mint`           — the domain profile pipeline, `aegis.mint(profile, content, options)`.
 * - `domain-sign`    — `aegis.sign(input)`, the PROFILE-LESS domain sign verb.
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
 * - `forged`         — a token assembled AS THE WIRE, for a shape no producer
 *                      would emit and no claims dict can hold.
 */
type TokenGivenShape =
  | MintGivenStep
  /**
   * `aegis.sign` — the DOMAIN sign verb, the profile-less twin of `mint`, and
   * CLAIMS ONLY (`jwt` / `cwt` / `cwm`, defaulting to `jwt`). The only thing it
   * does not do that `mint` does is apply a profile's floor, so a row here states
   * what a signature owes with NO profile in play.
   *
   * ⚠ There is no `door` discriminator. There was one while the verb also signed
   * opaque formats; a union with a single member states nothing, so the shape is
   * flat. An opaque signature is `via: "kit-sign", kit: "opaque"`.
   *
   * The step names no format: the run's wire picks `jwt` or `cwt`, so ONE row
   * states the capability on both wires. `cwm` (COSE_Mac0) is not reachable
   * agnostically — it needs a symmetric key, so a row about it states `key`.
   */
  | {
      step: "token";
      via: "domain-sign";
      /**
       * DOMAIN claims, typed against the registered vocabulary — the same typo
       * guard the mint content has. `unregisteredClaims` is the open remainder.
       */
      claims: RegisteredClaims;
      unregisteredClaims?: Dict;
      options?: DomainSignOptions;
    }
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
   * `tokenType` prefix floors to the bare conventional form. A typ-LESS token is
   * conformant, ordinary, and unproducible here (RFC 7519 §5.1, RFC 9596 §2). A
   * presence policy stated against tokens that always satisfy it is a policy
   * nothing tests.
   *
   * `typ` is the ONE header parameter this step controls, and it is stated as the
   * FULL header value on either wire (`"at+jwt"`, `"application/at+cwt"`); absent
   * means the producer stamps none. It may be stated PER WIRE, because the two
   * spellings of one media type are different strings (RFC 8392 §9.2,
   * RFC 7519 §5.1), so a row asserting a typed foreign token on both wires cannot
   * name one value for both.
   *
   * `key` names the vault resident the producer signs with; absent means the
   * baseline `ec-sig` key. A SYMMETRIC key changes the COSE STRUCTURE rather than
   * only the algorithm, so the producer emits a COSE_Mac0 for one — the only MAC
   * structure aegis reads. RFC 9052 §4.2, RFC 9052 §6.2.
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
      buckets?: ForeignHeadersGiven;
    }
  /**
   * A FORGED token — assembled as THE WIRE ITSELF, because the shape under test
   * is one no producer would emit and one a claims dict physically cannot hold.
   *
   * ⭐⭐ WHY THE VERB EXISTS. Every other artifact step states its token as a
   * claims DICT and the interpreter serialises it — `JSON.stringify` on JOSE,
   * `cbor2` on COSE. So any wire shape a JS object cannot express is unreachable
   * from this table, and a real capability lives in exactly that class: a CBOR map
   * keying one member BOTH at its integer label and under its text name (an object
   * holds one or the other, never both). `carries` is a LIST rather than a bag for
   * exactly that reason — it is what lets a row state one member twice.
   *
   * ⛔ THE INTERPRETER OWNS ALL ENCODING. A row never carries base64url, CBOR
   * bytes, an algorithm identifier or a COSE label table: it states the member
   * list and the interpreter writes the envelope, the tag chain and the
   * signature. A row that carried bytes would be asserting against a wire it had
   * written itself.
   *
   * ⚠ THE COSE ENVELOPE IS THE INTERPRETER'S, exactly as the foreign producer's
   * `alg`/`kid` are, and for the same reason: the row states the hostile CLAIM,
   * and a token a reader could not get through at all would observe nothing. The
   * interpreter supplies the minimum a reader needs to REACH that claim — issuer,
   * subject, and an expiry inside the row's own clock — through aegis's own CWT
   * codec in its interoperable spelling. A row that also had to spell an issuer
   * would bury the one fact it states. ⚠ A hostile ENVELOPE on the COSE wire is a
   * different capability and has no step.
   *
   * ⚠ `wire` PINS THE ROW to `"cose"`, and it must: a keyed CBOR map is a COSE
   * serialisation with no JOSE form at all, so the row owes the JOSE wire an
   * `unsupported` reason like any other pinned artifact.
   */
  | {
      step: "token";
      via: "forged";
      wire: "cose";
      claim: ForgedClaim;
      carries: ReadonlyArray<ForgedMember>;
      signature: ForgedSignature;
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
      options?: JwtSignOptions;
    }
  | {
      step: "token";
      via: "kit-sign";
      kit: "cwt";
      claims: CwtClaimsWire & Dict;
      options?: CwtSignOptions;
    }
  /**
   * The wire-agnostic OPAQUE passthrough — `jws` on JOSE, `cws` on COSE.
   *
   * ⚠ The bags the interpreter DELIVERS differ in exactly one member, the custom
   * bucket, and the row states it in the JOSE spelling for the interpreter to
   * re-spell for COSE ({@link AgnosticCustom}) — the same direction, and the same
   * reason, as the claim re-spelling the agnostic STRUCTURED step above documents.
   * The raw kit bags differ in `proprietary` too; {@link Agnostic} is what closes
   * that, by removing the COSE-only knob before a row can state it.
   *
   * Every other member is shared, so a member this step can express is a member
   * both wires honour. If they diverge again in a member the interpreter cannot
   * translate, this step must be typed against the NARROWER bag and the wider
   * one's row moved to the wire that takes it.
   */
  | {
      step: "token";
      via: "kit-sign";
      kit: "opaque";
      claims: TokenContent;
      options?: OpaqueSignOptions;
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
      options?: SealedSealOptions;
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

/**
 * Register a custom profile on the deployment — `Aegis.registerProfile`, the
 * public door a consumer extends the profile vocabulary through.
 *
 * ⚠ Its policy is restricted to the FREE rules, which is not a narrowing of the
 * capability but the row format asserting itself: `requiredWhen` carries a
 * `when` FUNCTION, and no row may hold a function value. A capability that needs
 * a conditional rule is stated against `id_token`, which declares one.
 *
 * ⚠ The registration lands on the CURRENT deployment, and a `deployment` step
 * builds a new one — so a row stating both must register AFTER it. The tuple
 * cannot express that ordering, so it is stated here.
 */
export type ProfileGivenStep = {
  step: "profile";
  profile: TokenProfileInput<
    ReadonlyArray<Exclude<PolicyRule, { rule: "requiredWhen" }>>
  >;
};

/** The steps that stock the world before the artifact exists. */
export type SetupGivenStep =
  | KeysGivenStep
  | ClockGivenStep
  | DeploymentGivenStep
  | ProfileGivenStep;

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
 * A conformant proof's `ath` commits to the access token it is presented with
 * (RFC 9449 §4.2), and that token does not exist until the GIVEN has run. A
 * literal proof in the table could only commit to a token no row
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
   * which a server's replay check runs on — RFC 9449 §11.1) and `htm`/`htu` (the
   * HTTP request it commits to).
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
  /**
   * The token's OWN kind. A sign-then-encrypt states the SIGNED format here and
   * the envelope under {@link AcceptsThenStep.wrapper} — a caller asking what the
   * token is gets the same answer either way, so a row about a capability states
   * the same `format` whether or not it also encrypts.
   */
  format?: TokenFormatTag | Partial<Record<Wire, TokenFormatTag>>;
  /**
   * The envelope enclosing the token, when one does — and `null` to assert that
   * NOTHING does.
   *
   * ⚠ ITS PRESENCE IS THE DISCRIMINATOR. `"jwe"` is a legitimate `format` in its
   * own right — a BARE `aegis.encrypt` result — so a row that stated only
   * `format: "jwe"` could not distinguish "a signed token in an envelope" from
   * "a sealed blob". Stating `wrapper` is how a row says which one it means.
   *
   * ⚠ `null` IS NOT THE SAME AS OMITTING IT, and the difference is the whole
   * reason the member exists. Omitted means the row says nothing about the
   * envelope and the interpreter checks nothing; `null` means the row asserts
   * there is none. Without an absence member the ABSENT half of a discriminator
   * this docstring calls load-bearing was inexpressible, so a row named for it
   * could assert nothing — and a fabricated wrapper passed unnoticed.
   */
  wrapper?: TokenFormatTag | Partial<Record<Wire, TokenFormatTag>> | null;
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
  /**
   * The refusal's own `code`, when WHICH refusal fired is part of the capability
   * rather than incidental to it.
   *
   * ⚠ The CLASS is not always enough, and where it is not, saying so is the row's
   * job. Two refusals can share a class AND a `data` shape while stating
   * different rules — `header_kit_owned_in_custom` and
   * `header_registered_in_custom` both throw a leaf error carrying
   * `{ parameter, bucket }` — so a row that names only the class passes whichever
   * fired, and the narrower rule it meant to pin goes unprobed.
   */
  code?: string;
  data?: Dict;
};

/**
 * A RAW WIRE KEY: a JOSE parameter/claim NAME (`typ`, `jti`) or a COSE integer
 * LABEL (`4`, `-70000`). NEVER a domain name — the wire steps report and compare
 * in the wire's own vocabulary, which is the only vocabulary an independent
 * reader has.
 *
 * ⚠ The integer `4` and the text string `"4"` are different COSE labels
 * (RFC 9052 §1.5), and CBOR keys them apart, so a row naming one never matches
 * the other. That is deliberate: conflating them is precisely the class of
 * mistake these steps exist to catch.
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
/**
 * What a row asserts about ONE `custom` header bag. The same TWO-ARM shape
 * {@link WireAssertion} uses and for the same reason: with both lists optional,
 * `{ step: "customHeader", bucket: "protected" }` typechecks and asserts
 * NOTHING, so a row could name the step, look thorough, and check nothing at all.
 * At least one list is required.
 *
 * Keys are the ISSUER'S own — a JOSE member name, or a COSE label stringified —
 * so there is no closed vocabulary here, unlike {@link WireKey}.
 */
export type CustomAssertion =
  | { includes: Dict; excludes?: ReadonlyArray<string> }
  | { includes?: Dict; excludes: ReadonlyArray<string> };

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
      /**
       * ⚠ A WIRE name is admissible here, not only a domain one, and that is the
       * point of the wider type: the domain header's vocabulary is CLOSED, so
       * excluding a name it has no member for is the assertion "the wire's
       * vocabulary did not leak into this tier" — which cannot be spelled with
       * `keyof DomainTokenHeader` alone.
       */
      excludes?: ReadonlyArray<keyof DomainTokenHeader | (string & {})>;
    }
  /**
   * The WIRE header a KIT door reports — JOSE-named and untranslated: the
   * integrity-protected bucket, which is {@link CoseHeaderBuckets.protectedHeader}
   * on COSE and the ONE {@link JoseHeaderBuckets.header} on JOSE.
   *
   * ⛔ IT IS A SEPARATE STEP BECAUSE `header` IS THE DOMAIN ONE, ALWAYS. The two
   * tiers use different vocabularies for the same parameter (`crit` vs
   * `critical`, `alg` vs `algorithm`), so one step reporting whichever tier the
   * last act happened to produce would make a row's meaning depend on its `when`
   * — and two rows spelling the same assertion differently would both be right.
   * A `kit-verify` reports THIS one and no `header`; every other act the reverse,
   * so a row that names the wrong one fails by name rather than silently
   * asserting against the other tier's spelling.
   */
  | ({ step: "wireHeader" } & CustomAssertion)
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
  | ({ step: "wireClaims" } & WireAssertion)
  /**
   * The WIRE-tier `custom` header bag a KIT door reports — the parameters no
   * registry row answers for, per bucket, verbatim as the issuer wrote them.
   *
   * Keys are the ISSUER'S OWN, so no closed vocabulary exists here: a JOSE member
   * name, or a COSE label stringified (`String(label)` — a tstr label is already
   * its own key, an integer one becomes its decimal spelling).
   *
   * ⚠ `bucket` is the COSE spelling on both wires. JOSE has ONE header and it is
   * the protected one, so `"protected"` reads it and `"unprotected"` REFUSES a
   * JOSE run rather than reading an empty bag (`run-scenario.ts#customBucketOf`).
   *
   * ⛔ Only a `kit-verify` reports one. The DOMAIN verbs report none — an
   * unregistered wire parameter has no domain name — so a row asserting on this
   * after `verify`/`decrypt` FAILS by name. That refusal IS the tier boundary,
   * stated where a row can read it.
   */
  | ({ step: "customHeader"; bucket: "protected" | "unprotected" } & CustomAssertion);

/**
 * An observation, optionally scoped to ONE wire.
 *
 * `on` exists for the observations that genuinely cannot be stated once: a raw
 * COSE label (`4`) and a raw JOSE claim name (`exp`) are different assertions
 * about the same domain fact, and CBOR keys an integer and a text string apart
 * (RFC 9052 §1.5), so neither spelling can stand for both. Scoping the
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
   * is a gap, and a gap is what {@link Scenario.knownDefect} states — not this
   * field, whose job is to close the question.
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
 * ⚠ The COSE wire is NOT thumbprint-less — it has `ckt` (RFC 9679 §5.6,
 * RFC 9679 §8), so "COSE has no thumbprint confirmation" would be false. What
 * has no COSE spelling is the JOSE one, and the two are not interchangeable
 * because they hash different canonicalisations of the same key.
 */
export const NO_JKT_ON_COSE =
  "a JWK thumbprint confirmation has no CWT counterpart (RFC 9679 §5.5). The COSE wire has a thumbprint confirmation of its own, `ckt` (RFC 9679 §5.6, RFC 9679 §8), but it is the digest of the key's canonical CBOR whereas RFC 7638 §3 digests its canonical JSON, so the same key yields DIFFERENT bytes and a `jkt` can never be relabelled as its COSE counterpart. A bound token cannot be built on this wire to present in the first place";

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
 * along for older clients (RFC 7515 §4.1.7). Restated as literals for the same reason as
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
      "The audience floor is what stops a token minted for one resource being replayed at another (RFC 7519 §4.1.3, RFC 8392 §3.1.3). Only the registered wire claim states who the issuer meant it for. An unregistered custom claim that merely spells the same word differently carries no such statement, so it must never be able to answer the check on the wire claim's behalf — otherwise the presenter, not the issuer, decides the audience.",
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
      "`aud` is the claim by which an issuer names who a token is for, on either encoding (RFC 7519 §4.1.3, RFC 8392 §3.1.3). A token that omits it names nobody, so a verifier identifying itself cannot be in it. ⚠ Failing on ABSENCE at VERIFY is AEGIS POLICY, not a citation: the claim is OPTIONAL and its mandated rejection is scoped to a token that carries it (RFC 7519 §4.1.3), so the specification permits exactly what this floor refuses. The floor exists because a rule that only compares the registered claim WHEN PRESENT lets a presenter supply a look-alike of its own and be believed, which hands the audience decision to the party the check exists to constrain.",
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
      "A token whose `aud` names someone else was minted for another resource, and accepting it is the replay the claim exists to stop. The refusal is owed on either encoding (RFC 7519 §4.1.3, RFC 8392 §3.1.3).",
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
      "A token that claims to be bound but is not is strictly worse than a bearer token, because the verifier stops asking for a proof. No COSE label carries a JWK thumbprint (RFC 9679 §5.5); the COSE thumbprint confirmation that does exist, `ckt` (RFC 9679 §5.6), digests the key's canonical CBOR while RFC 7638 §3 digests its canonical JSON, so the same key yields DIFFERENT bytes and emitting one under the other's label would mislabel the digest and fail against any conformant verifier. A confirmation the wire cannot carry must therefore fail closed at mint rather than be dropped on the way out.",
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
    // from the list, which is what makes this a per-MEMBER refusal.
    then: [{ step: "rejects", error: "CoseError", data: { members: ["jkt"] } }],
    unsupported: {
      jose: "the JOSE wire CAN carry this confirmation, so there is no refusal to state on it: `cnf.jkt` is the base64url-encoded SHA-256 JWK thumbprint of the key the token is bound to (RFC 9449 §6.1, RFC 7638). A mint that refused a `jkt` there would refuse the conformant shape",
    },
  },
  {
    id: "a-bound-token-without-a-proof-is-refused",
    title:
      "a token carrying a confirmation is refused when the verifier is shown no proof of possession",
    rationale:
      "A confirmation claim is the issuer declaring that the presenter possesses a particular key, and that the recipient can cryptographically confirm it (RFC 7800 §3). A verifier handed no proof has nothing to check the binding against, so it must refuse rather than quietly fall back to bearer semantics.",
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
    id: "a-declared-binding-is-honoured-however-empty-its-thumbprint",
    title:
      "a token declaring a confirmation whose thumbprint is empty is refused, not read as unbound",
    rationale:
      "A confirmation claim is the issuer's declaration that the presenter holds a particular key, and that the recipient can confirm it (RFC 7800 §3). A verifier deciding whether a token is bound is therefore reading whether the issuer DECLARED a binding, not whether the declared value is usable: a thumbprint nobody can match is a binding that cannot be honoured, and the only safe response to one is refusal. Downgrading it to bearer semantics inverts the security property — the weakest possible confirmation would buy the widest possible acceptance, so an attacker who can blank one field turns a sender-constrained token into one anybody holding a copy may present.",
    given: [
      // ⚠ THE EMPTY STRING is this row's form. `null`, `42` and `{}` are refused
      // at the READ, which is a different capability — a member whose value
      // contradicts its declared shape — and it has its own row
      // (`a-confirmation-this-package-cannot-read-is-refused-not-reported-as-
      // absent`). ⚠ `null` is in that family and STAYS in it: a confirmation
      // member is the one position in the package where a null is a contradiction
      // rather than an absence: a `jkt` is a thumbprint or the member is not one
      // (RFC 9449 §6.1), and an erased one mints an unbound token. This row stays
      // on the empty string because that is the form that is perfectly READABLE
      // and still binds nothing.
      //
      // A FOREIGN token: minting cannot produce this shape, because the
      // `confirmation` shape rule refuses a thumbprint that is not 32 base64url
      // bytes. The profile-less verify below is the door where no shape rule
      // runs behind the binding check either.
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          iat: NOW,
          exp: NOW + 120,
          jti: "token-1",
          cnf: { jkt: "" },
        },
        options: { tokenType: "access" },
      },
    ],
    when: [{ step: "verify" }],
    // ⚠⚠ `member` IS WHAT MAKES THIS ROW ATTRIBUTABLE, and `format` alone was not.
    // Every refusal this gate throws stamps `data: { format }` — including
    // `dpop_token_not_bound`, which fires on the SAME token when the verdict is
    // absent and a proof is supplied. Measured: with the confirmation half of the
    // predicate deleted, a row pinning `format` alone stayed GREEN on that other
    // refusal. `member` names WHICH value was named-but-unsatisfied, so the six
    // rows in this group are told apart from each other and from their neighbour.
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: { format: "jwt", member: "cnf.jkt" },
      },
    ],
    unsupported: {
      cose: NO_JKT_ON_COSE,
    },
  },
  {
    id: "vouching-for-a-binding-cannot-supply-one-the-token-never-stated",
    title:
      "a caller vouching that a binding was already proven is still refused a confirmation that binds no key",
    rationale:
      "Vouching says the proof was checked upstream — a gateway that validated it and forwarded the token — so it substitutes for the PROOF, never for the binding the proof was checked against. A confirmation whose thumbprint names nothing gives the upstream checker nothing to have checked, so the vouch attests to something that cannot have happened, and honouring it turns the weakest possible confirmation into the widest possible acceptance. A verifier must refuse a constraint it cannot make sense of on every path that reaches it, including the paths where it is told not to look.",
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
          exp: NOW + 120,
          jti: "token-1",
          cnf: { jkt: "" },
        },
        options: { tokenType: "access" },
      },
    ],
    when: [{ step: "verify", options: { trustBoundThumbprint: true } }],
    // ⚠ `data` IS THE WHOLE POINT OF THIS ROW, and it is read off real errors
    // rather than guessed at. Every refusal the policy gate throws stamps
    // `data: { format }`, while the proof COMPARISON's own refusal carries no
    // `data` at all
    // (`src/internal/utils/verify-dpop-proof.ts#if (thumbprint !== expectedThumbprint) {`).
    // So `format` is precisely the discriminator between a refusal that judged
    // the CONFIRMATION and one that judged the presenter's PROOF, which is what
    // this row and the one below it are about — and it is what made both of them
    // red for as long as the vouch was honoured as the last word on this path.
    // ⚠⚠ `member` IS WHAT MAKES THIS ROW ATTRIBUTABLE, and `format` alone was not.
    // Every refusal this gate throws stamps `data: { format }` — including
    // `dpop_token_not_bound`, which fires on the SAME token when the verdict is
    // absent and a proof is supplied. Measured: with the confirmation half of the
    // predicate deleted, a row pinning `format` alone stayed GREEN on that other
    // refusal. `member` names WHICH value was named-but-unsatisfied, so the six
    // rows in this group are told apart from each other and from their neighbour.
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: { format: "jwt", member: "cnf.jkt" },
      },
    ],
    unsupported: {
      cose: NO_JKT_ON_COSE,
    },
  },
  {
    id: "a-proof-cannot-be-checked-against-a-confirmation-that-binds-no-key",
    title:
      "presenting a real proof of possession against a confirmation that binds no key is refused",
    rationale:
      "A proof of possession is only meaningful against the key the token names, so a presenter offering a perfectly valid proof for a confirmation that names no key has demonstrated possession of nothing the token asked about. The refusal must come from the confirmation being unusable rather than from the comparison failing: a verifier that reaches the comparison at all has accepted the binding as something checkable, and would report the presenter's proof as the problem when the token is.",
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
          exp: NOW + 120,
          jti: "token-1",
          cnf: { jkt: "" },
        },
        options: { tokenType: "access" },
      },
    ],
    when: [
      {
        step: "verify",
        dpopProof: {
          key: "ec-sig",
          tokenId: "proof-1",
          httpMethod: "GET",
          httpUri: "https://rs.lindorm.io/resource",
        },
      },
    ],
    // The `data` pin is what makes this row about the CONFIRMATION rather than
    // about the proof — see the note on the vouch row above for why `format` is
    // the discriminator and why it is read rather than guessed. It was red on a
    // refusal that DID fire: with a proof supplied, the empty thumbprint reached
    // `verifyDpopProof` and failed the comparison as `dpop_thumbprint_mismatch`,
    // naming the presenter's key as the problem and carrying no `data` at all.
    // ⚠⚠ `member` IS WHAT MAKES THIS ROW ATTRIBUTABLE, and `format` alone was not.
    // Every refusal this gate throws stamps `data: { format }` — including
    // `dpop_token_not_bound`, which fires on the SAME token when the verdict is
    // absent and a proof is supplied. Measured: with the confirmation half of the
    // predicate deleted, a row pinning `format` alone stayed GREEN on that other
    // refusal. `member` names WHICH value was named-but-unsatisfied, so the six
    // rows in this group are told apart from each other and from their neighbour.
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: { format: "jwt", member: "cnf.jkt" },
      },
    ],
    unsupported: {
      cose: NO_JKT_ON_COSE,
    },
  },
  {
    id: "a-confirmation-that-binds-no-key-is-refused-when-no-proof-is-shown",
    title:
      "a token whose confirmation names no key at all is refused rather than read as unbound",
    rationale:
      "By including a `cnf` claim the issuer declares that the presenter possesses a particular key, and that the recipient can cryptographically confirm it (RFC 7800 §3). A confirmation object with no member declares exactly that and names nothing to confirm, so there is no binding a verifier could check and no honest way to proceed. Reading it as an absent confirmation inverts the security property: the emptiest possible declaration would buy the widest possible acceptance, and an attacker who can strip the members of a confirmation turns a sender-constrained token into one anybody holding a copy may present.",
    given: [
      // ⚠⚠ `cnf: {}` — THE OTHER VALUE THE VERDICT JUDGES, and the one that had
      // no row at all. The three sibling rows above all carry `cnf: { jkt: "" }`,
      // so the `thumbprint` half of the predicate was pinned three times over and
      // the `confirmation` half not once: deleting it from the check left the whole
      // suite green while `cnf: {}` verified as a plain bearer token.
      //
      // A FOREIGN token: `mint` refuses an empty confirmation on the way out, so
      // this shape can only be presented by somebody else's producer.
      {
        step: "token",
        via: "foreign",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          iat: NOW,
          exp: NOW + 120,
          jti: "token-1",
          cnf: {},
        },
        typ: "application/access+jwt",
      },
    ],
    when: [{ step: "verify" }],
    // `data: { format }` like every sibling refusal in this gate — it is what
    // makes the refusal attributable to the CONFIRMATION rather than to anything
    // the presenter did.
    // ⚠⚠ `member` IS WHAT MAKES THIS ROW ATTRIBUTABLE, and `format` alone was not.
    // Every refusal this gate throws stamps `data: { format }` — including
    // `dpop_token_not_bound`, which fires on the SAME token when the verdict is
    // absent and a proof is supplied. Measured: with the confirmation half of the
    // predicate deleted, a row pinning `format` alone stayed GREEN on that other
    // refusal. `member` names WHICH value was named-but-unsatisfied, so the six
    // rows in this group are told apart from each other and from their neighbour.
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: { format: "jwt", member: "cnf" },
      },
    ],
    unsupported: {
      cose: "there is no empty confirmation on this wire to present. A COSE `cnf` is a map of RFC 8747 §3.1 labels, and `encodeCnf` (`src/internal/cose/cose-key.ts#if (out.size === 0) {`) refuses one that comes out with no member at all — so every producer using this codec, including the raw `aegis.cwt.sign` door a forgery would go through, fails closed before a token exists. The verifier rule this row states is about a token a verifier can be handed, and on this wire there is none to hand it. ⚠ That refusal is itself pinned, by `a-confirmation-the-wire-cannot-carry-is-refused-at-mint` and by `classes/confirmation-claim-wire.test.ts`",
    },
  },
  {
    id: "vouching-cannot-supply-a-binding-for-a-confirmation-with-no-member",
    title:
      "a caller vouching that a binding was already proven is still refused a confirmation with no member",
    rationale:
      "Vouching says the proof was checked upstream — a gateway that validated it and forwarded the token — so it substitutes for the PROOF and never for the binding the proof was checked against. A confirmation naming no key gives the upstream checker nothing to have checked, so the vouch attests to something that cannot have happened. This is the path a per-branch version of the verdict leaves open, which is why it is stated as its own row rather than inferred from the bare one.",
    given: [
      // ⚠⚠ `cnf: {}` — THE OTHER VALUE THE VERDICT JUDGES, and the one that had
      // no row at all. The three sibling rows above all carry `cnf: { jkt: "" }`,
      // so the `thumbprint` half of the predicate was pinned three times over and
      // the `confirmation` half not once: deleting it from the check left the whole
      // suite green while `cnf: {}` verified as a plain bearer token.
      //
      // A FOREIGN token: `mint` refuses an empty confirmation on the way out, so
      // this shape can only be presented by somebody else's producer.
      {
        step: "token",
        via: "foreign",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          iat: NOW,
          exp: NOW + 120,
          jti: "token-1",
          cnf: {},
        },
        typ: "application/access+jwt",
      },
    ],
    when: [{ step: "verify", options: { trustBoundThumbprint: true } }],
    // `data: { format }` like every sibling refusal in this gate — it is what
    // makes the refusal attributable to the CONFIRMATION rather than to anything
    // the presenter did.
    // ⚠⚠ `member` IS WHAT MAKES THIS ROW ATTRIBUTABLE, and `format` alone was not.
    // Every refusal this gate throws stamps `data: { format }` — including
    // `dpop_token_not_bound`, which fires on the SAME token when the verdict is
    // absent and a proof is supplied. Measured: with the confirmation half of the
    // predicate deleted, a row pinning `format` alone stayed GREEN on that other
    // refusal. `member` names WHICH value was named-but-unsatisfied, so the six
    // rows in this group are told apart from each other and from their neighbour.
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: { format: "jwt", member: "cnf" },
      },
    ],
    unsupported: {
      cose: "there is no empty confirmation on this wire to present. A COSE `cnf` is a map of RFC 8747 §3.1 labels, and `encodeCnf` (`src/internal/cose/cose-key.ts#if (out.size === 0) {`) refuses one that comes out with no member at all — so every producer using this codec, including the raw `aegis.cwt.sign` door a forgery would go through, fails closed before a token exists. The verifier rule this row states is about a token a verifier can be handed, and on this wire there is none to hand it. ⚠ That refusal is itself pinned, by `a-confirmation-the-wire-cannot-carry-is-refused-at-mint` and by `classes/confirmation-claim-wire.test.ts`",
    },
  },
  {
    id: "a-proof-cannot-be-checked-against-a-confirmation-with-no-member",
    title:
      "presenting a real proof of possession against a confirmation with no member is refused",
    rationale:
      "A proof of possession is only meaningful against the key the token names, so a presenter offering a perfectly valid proof for a confirmation that names nothing has demonstrated possession of nothing the token asked about. The refusal must come from the confirmation being unusable rather than from any comparison failing: a verifier that reaches a comparison at all has accepted the binding as something checkable, and would report the presenter's proof as the problem when the token is.",
    given: [
      // ⚠⚠ `cnf: {}` — THE OTHER VALUE THE VERDICT JUDGES, and the one that had
      // no row at all. The three sibling rows above all carry `cnf: { jkt: "" }`,
      // so the `thumbprint` half of the predicate was pinned three times over and
      // the `confirmation` half not once: deleting it from the check left the whole
      // suite green while `cnf: {}` verified as a plain bearer token.
      //
      // A FOREIGN token: `mint` refuses an empty confirmation on the way out, so
      // this shape can only be presented by somebody else's producer.
      {
        step: "token",
        via: "foreign",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          iat: NOW,
          exp: NOW + 120,
          jti: "token-1",
          cnf: {},
        },
        typ: "application/access+jwt",
      },
    ],
    when: [
      {
        step: "verify",
        dpopProof: {
          key: "ec-sig",
          tokenId: "proof-1",
          httpMethod: "GET",
          httpUri: "https://rs.lindorm.io/resource",
        },
      },
    ],
    // `data: { format }` like every sibling refusal in this gate — it is what
    // makes the refusal attributable to the CONFIRMATION rather than to anything
    // the presenter did. The proof COMPARISON's own refusal carries no `data` at all, so `format` is precisely the discriminator between a refusal that judged the CONFIRMATION and one that judged the presenter's key.
    // ⚠⚠ `member` IS WHAT MAKES THIS ROW ATTRIBUTABLE, and `format` alone was not.
    // Every refusal this gate throws stamps `data: { format }` — including
    // `dpop_token_not_bound`, which fires on the SAME token when the verdict is
    // absent and a proof is supplied. Measured: with the confirmation half of the
    // predicate deleted, a row pinning `format` alone stayed GREEN on that other
    // refusal. `member` names WHICH value was named-but-unsatisfied, so the six
    // rows in this group are told apart from each other and from their neighbour.
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: { format: "jwt", member: "cnf" },
      },
    ],
    unsupported: {
      cose: "there is no empty confirmation on this wire to present. A COSE `cnf` is a map of RFC 8747 §3.1 labels, and `encodeCnf` (`src/internal/cose/cose-key.ts#if (out.size === 0) {`) refuses one that comes out with no member at all — so every producer using this codec, including the raw `aegis.cwt.sign` door a forgery would go through, fails closed before a token exists. The verifier rule this row states is about a token a verifier can be handed, and on this wire there is none to hand it. ⚠ That refusal is itself pinned, by `a-confirmation-the-wire-cannot-carry-is-refused-at-mint` and by `classes/confirmation-claim-wire.test.ts`",
    },
  },
  {
    id: "a-confirmation-this-package-cannot-read-is-refused-not-reported-as-absent",
    title:
      "a token whose confirmation member holds a value of the wrong shape is refused, not read as unbound",
    rationale:
      "The confirmation claim is the issuer's declaration that the presenter holds a particular key (RFC 7800 §3). A reader that cannot make sense of the declared value has two honest options and one dangerous one: it may refuse, or it may report the token as stating something it cannot interpret — but it must not report the token as stating NOTHING. Erasing an unreadable member turns the issuer's binding into an absence, and an absence is precisely what a verifier reads as bearer semantics, so an attacker who can substitute one field for a value of the wrong type widens acceptance from one key-holder to anybody holding a copy of the token.",
    given: [
      // A FOREIGN token: `mint` cannot produce this shape, because the domain
      // `confirmation` is typed and the same refusal fires on the way out.
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          aud: [RESOURCE],
          iat: NOW,
          exp: NOW + 120,
          jti: "token-1",
          // A NUMBER where a base64url string belongs (RFC 9449 §6.1). It is the
          // representative of the whole family — `null`, `42`, `{}` and a `cnf`
          // that is not an object.
          //
          // ⚠ THE CAST IS THE ROW'S SUBJECT, not a convenience. `ConfirmationClaimWire`
          // types `jkt` as a string, so aegis's OWN type system already forbids
          // this shape — which is exactly why the rule is about a FOREIGN token
          // and why the row has to reach past the type to state it. A stranger's
          // wire is not bound by our declarations.
          cnf: { jkt: 42 as unknown as string },
        },
        options: { tokenType: "access" },
      },
    ],
    when: [{ step: "verify" }],
    // `claim`, not `format`: this refusal comes from the claim TRANSLATOR rather
    // than from the verify policy gate, which is what says the token was rejected
    // for being unreadable rather than for binding nothing. The two are different
    // faults and the sibling rows above pin the other one.
    then: [
      { step: "rejects", error: "AegisDomainError", data: { claim: "confirmation" } },
    ],
    unsupported: {
      cose: NO_JKT_ON_COSE,
    },
  },
  {
    id: "a-confirmation-member-spelled-in-the-other-vocabulary-is-refused",
    title:
      "a confirmation naming a member in the wrong vocabulary is refused, not written into the declared member's slot",
    rationale:
      "Absent an application requirement of its own, an unrecognised confirmation member must be ignored rather than treated as an error, on either encoding (RFC 7800 §3.1, RFC 8747 §3.1). A member aegis DOES understand, misspelled, is a different thing: `kid` and the domain `keyId` resolve to ONE key, so writing both into one bag lets whoever chose the order decide which binding the token states. Silence is the dangerous disposal — the caller sees the confirmation accepted, the token carries a value no grammar rule checked, and a verifier reads a binding nobody validated. The refusal must not depend on the declared member being present alongside it: a confirmation naming ONLY the misspelling has nothing to collide with, and that is precisely the case where the look-alike takes the declared member's slot uncontested.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "access_token",
        content: {
          subject: "user-1",
          audience: [RESOURCE],
          clientId: CLIENT,
          // `kid` is the WIRE spelling of the declared `keyId`, which a caller
          // reading any RFC would reach for. ⚠⚠ THE DECLARED MEMBER IS ABSENT,
          // and that is what makes this row state the rule its rationale claims:
          // with BOTH present there is a live collision to notice, so a refusal
          // built only from what ARRIVED passes such a row while leaving the
          // dangerous case — the misspelling alone, taking the declared slot
          // uncontested — wide open. ⚠ Deliberately the member BOTH wires carry
          // (RFC 7800 §3.4, RFC 8747 §3.1 label 3), so the rule is stated on each
          // rather than on JOSE alone.
          confirmation: { kid: "k2" } as never,
        },
      },
    ],
    when: [{ step: "mint" }],
    // ⚠⚠ BOTH ENTRIES, IN ORDER — and a single-entry pin would NOT have been
    // weaker by degree, it would have been satisfied by the wrong build. A
    // confirmation naming ONLY the misspelling produces TWO violations: the
    // collision, and then `names no key to confirm`, because with the colliding
    // member refused there is nothing left in the bag. So a build that merely
    // DROPPED the colliding member instead of refusing it would still fail on the
    // second entry alone and pass a pin that named only the first. `toMatchObject`
    // compares array length, which is what makes stating both a real constraint.
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: {
          claim: "confirmation",
          invalid: [
            {
              key: "confirmation.kid",
              message:
                'Members "keyId" and "kid" both resolve to "kid" in "confirmation"',
            },
            {
              key: "confirmation",
              message: 'Claim "confirmation" names no key to confirm',
            },
          ],
        },
      },
    ],
  },
  {
    id: "a-confirmation-that-names-no-key-is-refused-at-mint",
    title:
      "a mint asked for a confirmation that names no key is refused rather than issuing a bearer token",
    rationale:
      "By including a `cnf` claim the issuer declares that the presenter possesses a particular key, and that the recipient can cryptographically confirm it (RFC 7800 §3, RFC 8747 §3). A confirmation naming no key declares a possession nobody can confirm, so neither disposal of it is a token anyone asked for: dropping the claim hands the audience a BEARER token where the issuer asked for a bound one, and emitting it puts a binding on the wire that a conformant verifier must reject. The issuer is the one party that can still repair the request, so the refusal belongs at the mint.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "access_token",
        content: {
          subject: "user-1",
          audience: [RESOURCE],
          clientId: CLIENT,
          // Every member absent. A caller assembling a confirmation out of
          // optionals it turned out not to have arrives here.
          confirmation: {},
        },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      { step: "rejects", error: "AegisDomainError", data: { claim: "confirmation" } },
    ],
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
    id: "a-proof-presented-with-an-unbound-token-is-refused",
    title:
      "presenting a proof of possession with a token that carries no confirmation is refused",
    rationale:
      "A proof-of-possession check compares the key the token is bound to against the key that made the proof (RFC 9449 §4.3), so a token with no binding leaves nothing on one side of the comparison. Accepting the presentation would mean a proof of possession of ANY key satisfied a token that committed to none — proof-of-possession semantics claimed for a bearer token, which is the confusion the confirmation claim exists to prevent. The presenter must be told the token is unbound rather than have the proof quietly ignored.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "access_token",
        content: { subject: "user-1", audience: [RESOURCE], clientId: CLIENT },
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
    then: [{ step: "rejects", error: "AegisDomainError", data: { format: "jwt" } }],
    unsupported: {
      cose: NO_JKT_ON_COSE,
    },
  },
  {
    id: "a-proof-made-by-a-different-key-than-the-token-names-is-refused",
    title:
      "a token carrying a confirmation is refused when the proof is made by a different key",
    rationale:
      "The check the whole mechanism rests on is that the key the access token is bound to is the key that made the proof (RFC 9449 §4.3). A proof made by a key the token did not name is exactly what a thief presents — the stolen token plus a key they do hold — so a verifier that accepts one has kept the ceremony and lost the property. The proof being internally well-formed and correctly signed is not the question; whose key signed it is.",
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
        // A DIFFERENT key from the one the confirmation names, and otherwise a
        // conformant proof — so the refusal is attributable to the key alone.
        dpopProof: {
          key: "ec-sig",
          ath: "presented",
          tokenId: "dpop-proof-1",
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
  {
    id: "a-bound-token-verifies-against-a-proof-made-by-the-key-it-names",
    title:
      "a token carrying a confirmation verifies when the presenter proves possession of the confirmed key",
    rationale:
      "A confirmation is the issuer declaring that the presenter possesses a particular key and that the recipient can cryptographically confirm it (RFC 7800 §3), so the floor must be able to say YES and not only NO — a check that can only refuse leaves proof-of-possession unusable and deployments drop the confirmation instead. The check is that the key the token is bound to is the key that made the proof (RFC 9449 §4.3). The proof's own claims must then reach the caller, because the resource server is what acts on them: `jti`, `htm` and `htu` (RFC 9449 §4.2) are what a single-use check and a request-binding check run on, and a verifier that swallowed them would leave both with nothing.",
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
      "`ath` commits a proof to ONE access token, and the verifier compares it against the token actually presented (RFC 9449 §4.2, RFC 9449 §4.3). The claim is what stops a proof from being reusable beyond the request it was made for: without it a proof observed against one token would authorise every other token the observer holds, and the possession check would establish possession of the key while establishing nothing about which token it was presented with.",
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
      "The verifier confirms that the key the access token is bound to is the key that made the proof (RFC 9449 §4.3). A proof carries its own public key in its header, so a verifier that checked only that the proof was internally consistent would accept one that any holder of the token could mint for themselves, and the binding would assert nothing at all.",
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
      // BOTH recipient keys: JOSE seals with the ECDH-ES key, while a
      // COSE_Encrypt0 names no recipient and runs no recipient algorithm
      // (RFC 9052 §5.2), so aegis seals it with a symmetric key known out of band
      // — an agreement key has no form on that wire and the COSE run needs the
      // symmetric one.
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
    then: [
      {
        step: "accepts",
        format: { jose: "jwt", cose: "cwt" },
        wrapper: { jose: "jwe", cose: "cwe" },
      },
    ],
  },
  {
    id: "a-sensitive-claim-named-with-an-empty-value-is-still-a-sensitive-claim",
    title:
      "naming a sensitive claim with an empty value still forces the confidentiality decision",
    rationale:
      "The confidentiality gate asks whether the issuer WROTE a sensitive claim, not whether the value they wrote carries information. The two questions come apart on an empty value, and only one of them is safe: an issuer assembling content from optional fields reaches an empty national identity number by exactly the path they reach a populated one, so a gate that reads emptiness as absence is a gate that stops firing whenever the upstream field happens to be blank. Deciding disclosure from the value rather than from the name also makes the decision data-dependent — the same code path protects some subjects and not others — which is precisely what a registry-driven category exists to prevent.",
    given: [
      { step: "keys", keys: ["ec-enc", "oct-enc"] },
      {
        step: "token",
        via: "mint",
        profile: "userinfo",
        content: {
          subject: "user-1",
          audience: [CLIENT],
          claims: { nationalIdentityNumber: "" },
        },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      {
        step: "accepts",
        format: { jose: "jwt", cose: "cwt" },
        wrapper: { jose: "jwe", cose: "cwe" },
      },
    ],
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
      // BOTH recipient keys: JOSE seals with the ECDH-ES key, while a
      // COSE_Encrypt0 names no recipient and runs no recipient algorithm
      // (RFC 9052 §5.2), so aegis seals it with a symmetric key known out of band
      // — an agreement key has no form on that wire and the COSE run needs the
      // symmetric one.
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
    then: [
      {
        step: "accepts",
        format: { jose: "jwt", cose: "cwt" },
        wrapper: { jose: "jwe", cose: "cwe" },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Critical header parameters.
  // ---------------------------------------------------------------------------
  {
    id: "a-specification-defined-critical-parameter-is-refused-at-verify",
    title:
      "a foreign token whose crit names a parameter the specification itself defines is refused at verify",
    rationale:
      "A producer may not name a specification-defined parameter in `crit`, and a recipient may treat a token that does as invalid (RFC 7515 §4.1.11). aegis takes the recipient option, at verify as at the mint. It is not a harmless redundancy — it is a producer asserting that the parameter carries meaning beyond what the specification gives it, which is precisely a meaning no recipient can look up. Accepting the token would mean processing it under the ordinary reading the producer just said was insufficient. The refusal must hold on BOTH encodings, because an enforcement present on one wire and absent on the other means the same token is refused or accepted by the presenter's choice of encoding, which is a choice an attacker makes. The sibling MINT row states the producer half; this is the recipient half, and only a FOREIGN producer can put it on the wire.",
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
        // `cty` is carried BESIDE the `crit` that names it, so the header is
        // otherwise well-formed and the refusal can only be about the member
        // being specification-defined — not about a parameter the header lacks,
        // which is a different rule and a different row.
        buckets: { protectedHeader: { crit: ["cty"], cty: "application/json" } },
      },
    ],
    when: [{ step: "verify" }],
    // ONE gate, ONE diagnosis, both wires. The classes sit at the SAME DEPTH of
    // the error tree — `CwtError` is the leaf `JwtError`'s counterpart, not
    // `CoseError`, which is the family root and would accept any COSE refusal
    // whatsoever.
    then: [
      { step: "rejects", on: "jose", error: "JwtError", data: { crit: ["cty"] } },
      { step: "rejects", on: "cose", error: "CwtError", data: { crit: ["cty"] } },
    ],
  },
  {
    id: "a-kit-owned-header-parameter-is-refused-from-the-custom-bag",
    title:
      "a parameter the kit derives from the key cannot be smuggled in as a custom one",
    rationale:
      "The parameters a kit derives — the algorithm, the key id, the content encryption, the certificate fields — describe crypto that actually happened, and a recipient reads them to decide how to process the token. A caller that could state one would be describing crypto that did not happen: an `alg` the signature does not use, an `x5c` no key backs. The registered header bag omits them at the type level, so the open set must not become the way back in — otherwise every guard the omission provides is bypassed by spelling the same name one field over. The refusal is DISTINCT from the one for any other specification-defined name, because the repair differs: a registered parameter has a bag that accepts it, and a kit-owned one has none at all.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: { iss: ISSUER, sub: "user-1", exp: NOW + 3600 },
        // `alg` is the sharpest member available: every kit reserves it on both
        // wires, and it is REQUIRED on every token, so a caller value could only
        // ever contradict the signature.
        options: { custom: { header: { alg: "ES256" } } },
      },
    ],
    when: [{ step: "mint" }],
    // ⚠ THE CODE, not merely the class: the sibling refusal for any other
    // specification-defined name throws the same class with the same `data`
    // shape, so a row naming only the class would pass whichever fired and the
    // distinction this row is about would go unprobed.
    then: [
      {
        step: "rejects",
        error: "AegisError",
        code: "header_kit_owned_in_custom",
        data: { parameter: "alg" },
      },
    ],
  },
  {
    id: "an-unregistered-header-parameter-a-foreign-issuer-wrote-is-carried-on-read",
    title: "a header parameter the library does not know is reported, never dropped",
    rationale:
      "A token header is an OPEN set, so a foreign issuer may legitimately carry parameters this library has never heard of. Dropping them hides what the token said: a reader inspecting the header cannot tell a parameter that was absent from one that was thrown away, and the issuer's statement is lost with no record that it was ever made. Reporting them in a bag of their OWN is what makes that safe — merging them into the typed header would mean handing a caller a value whose type says the key cannot exist, which is a claim nothing downstream can check. The bag is per BUCKET on COSE for the same reason the typed ones are: an unprotected parameter is covered by no signature, and a reader must be able to name the bucket it trusts.",
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
        buckets: { protectedHeader: { "x-foreign-hint": "issuer-wrote-this" } },
      },
    ],
    when: [{ step: "kit-verify", kit: "structured" }],
    then: [
      { step: "accepts" },
      // CARRIED — in its own bag, keyed as the issuer wrote it. On COSE that is
      // the tstr label (RFC 9052 §1.5), which is the same spelling.
      {
        step: "customHeader",
        bucket: "protected",
        includes: { "x-foreign-hint": "issuer-wrote-this" },
      },
      // …and NOT in the typed bag, whose type says the key cannot exist. The WIRE
      // header, because a `kit-verify` reports that tier.
      { step: "wireHeader", excludes: ["x-foreign-hint"] },
    ],
  },
  {
    id: "an-unregistered-header-parameter-stops-at-the-wire-tier",
    title: "an unregistered header parameter never reaches the domain header",
    rationale:
      "The domain surface exists so a caller never has to learn either wire's vocabulary — it reports `algorithm` and `keyId`, not `alg` and `kid`. An UNREGISTERED parameter has no domain name by definition: nothing translates it, so surfacing it would put raw wire spellings into the one result that promises there are none, and a caller reading the domain header could no longer tell which of its keys are the library's vocabulary and which are a stranger's. The parameter is not lost — the WIRE result reports it in full, which is the tier that speaks the wire. This is the boundary, and it must hold for a parameter aegis itself wrote as much as for a foreign one.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: { iss: ISSUER, sub: "user-1", exp: NOW + 3600 },
        options: { custom: { header: { "x-lindorm-hint": "carried" } } },
      },
    ],
    when: [{ step: "verify" }],
    then: [
      { step: "accepts" },
      // It IS on the wire — read by the INDEPENDENT inspector, so the row cannot
      // pass by the parameter never having been written in the first place.
      { step: "wireProtectedHeader", includes: { "x-lindorm-hint": "carried" } },
      // …and the DOMAIN header does not carry it.
      { step: "header", expected: {}, excludes: ["x-lindorm-hint"] },
    ],
  },
  {
    id: "a-text-label-cannot-impersonate-a-registered-header-parameter",
    title:
      "a COSE text label spelled like a registered parameter does not override the signed one",
    rationale:
      "The integer 1 and the text \"alg\" are DIFFERENT COSE labels naming different things (RFC 9052 §1.5) — but a reader that reports unregistered labels under their stringified form puts the text one in the same name-space as the registered one's JOSE spelling. Where both are present the reader must resolve to the parameter the ISSUER's integer label carries, because that is the one the signature covers and the one every conformant implementation reads. Resolving the other way lets any holder append a text label and restate `alg`, or `crit`, on a token they cannot re-sign — and the keyless read checks no signature at all, so a `crit` the issuer never wrote could satisfy the crit gate the reader runs (RFC 9052 §3.1). The unregistered value is still CARRIED, because a reader may not silently discard what a producer wrote; what it may not do is let it answer for a registered name.",
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
        // ⭐ THE SHAPE IS CHOSEN SO THE VERDICT DEPENDS ON WHICH `crit` ANSWERS.
        // The genuine one rides integer label 2 and names `oid` — which the header
        // does NOT carry, which makes it fatally malformed (RFC 9052 §3.1). The
        // impostor rides the TEXT label and names a parameter that IS present.
        // Read the registered form and the token is refused; read the impostor and
        // it sails through, which is the whole attack: a holder who cannot re-sign
        // the token appends two text labels and repairs its `crit`.
        buckets: {
          protectedHeader: { crit: ["oid"] },
          textLabelledProtected: { crit: ["x-shadow"], "x-shadow": "v" },
        },
      },
    ],
    when: [{ step: "kit-verify", kit: "structured" }],
    then: [
      {
        step: "rejects",
        error: "CwtError",
        code: "cwt_invalid_crit",
        data: { crit: ["oid"] },
      },
    ],
    unsupported: {
      jose: "a JOSE header is a JSON object with ONE name-space, so a parameter cannot be spelled twice — the collision this row is about exists only where two label FORMS name one parameter (RFC 9052 §1.5)",
    },
  },
  {
    id: "a-critical-refusal-reports-the-crit-the-verdict-was-decided-on",
    title:
      "the crit a refusal reports is the one the reader actually judged, not the typed bag beside it",
    rationale:
      'A refusal is only actionable if its data describes the thing refused. The read side SPLITS one header the producer wrote into a typed bag and a bag of parameters no registry row answers for, and a `crit` can arrive in either — the integer label 2 and the text "crit" are different labels (RFC 9052 §1.5), so a token carrying only the text one has an empty typed `crit`. A verdict decided on the merged header and reported off the typed bag hands the caller `crit: undefined` for a token that was refused precisely because of its `crit`, while the message names the offending member: the two halves of one refusal contradict each other and a consumer branching on `data` concludes there was no crit at all. Every door that judges a `crit` must therefore report the same value it judged.',
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
        // The TEXT label alone, with no integer label 2 anywhere: the reader files
        // it under the unregistered bag, so the typed bag's `crit` is absent while
        // the merged header's is what decides the verdict. The member names a
        // parameter the header does not carry, which is what makes it refusable.
        buckets: { textLabelledProtected: { crit: ["x-shadow"] } },
      },
    ],
    // The KEYLESS door, because it is the one that reads a header without a key —
    // and it judges a `crit` exactly as verify does.
    when: [{ step: "parse" }],
    then: [
      {
        step: "rejects",
        error: "CwtError",
        code: "cwt_invalid_crit",
        data: { crit: ["x-shadow"] },
      },
    ],
    unsupported: {
      jose: "a JOSE header has ONE JSON name-space (RFC 7515 §4), so `crit` always resolves to the typed bag and the two spellings this row separates cannot come apart",
    },
  },
  {
    id: "the-keyless-read-accepts-every-token-the-mint-produces",
    title: "a token this library signs can be read back by its own keyless reader",
    rationale:
      "`parse` and `verify` are two doors onto the same bytes, and a producer chooses between them by whether it holds a key — never by what the token says. So a token the mint emits must satisfy BOTH, and a rule enforced at one door and not the other is not a policy but an accident of which door a caller happened to use. The shape that exposes it is a `crit` naming a parameter the header carries: both readers must locate that parameter to decide the token is well-formed, and they look in different places — `verify` reads the registered bag beside the unregistered one, while a reader that consulted only the registered bag would conclude the token names a parameter it does not carry and refuse what this library had just signed. That conclusion is fatal rather than cosmetic (RFC 9052 §3.1): one door calls the token invalid and the other verifies it.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: { iss: ISSUER, sub: "user-1", exp: NOW + 3600 },
        // A CUSTOM parameter marked critical — the one shape whose two halves live
        // in different bags on the read side, which is what makes the two doors
        // able to disagree at all.
        options: {
          header: { crit: ["x-lindorm-hint"] },
          custom: { header: { "x-lindorm-hint": "carried" } },
        },
      },
    ],
    // BOTH doors, in ONE row, because the capability IS their agreement: split
    // across two rows they could drift apart and each stay green, which is the
    // failure this row exists to catch. The acts run in order and the LAST one's
    // result is asserted, so `parse` throwing fails the row before `verify` runs.
    when: [
      { step: "parse" },
      // The `crit` declaration on the verify leg only. `parse` takes none — it
      // asserts nothing about UNDERSTANDING the token — which is itself part of
      // what this row states about the two doors.
      { step: "verify", options: { critical: ["x-lindorm-hint"] } },
    ],
    then: [{ step: "accepts" }],
  },
  {
    id: "a-custom-parameter-marked-critical-is-carried-and-read-back",
    title:
      "a critical UNREGISTERED header parameter round-trips: minted, and accepted at verify by a caller that declares it",
    rationale:
      "`crit` may not name parameters the specification itself defines (RFC 7515 §4.1.11), which leaves an issuer's OWN extension as precisely what the parameter is for. A library that would mint such a token and then refuse it from every caller would be two disagreeing implementations: the same bytes valid when written and invalid when read. The duty to UNDERSTAND the extension belongs to the RECIPIENT, and a verification library is never the final recipient — it verifies on an application's behalf — so the round trip closes only when the caller states that it takes the parameter on. The two gates ask DIFFERENT questions and that is the point: the producer's is whether it may name the member at all, which a parameter it writes itself answers, while the recipient's is whether the application behind the verifier has claimed it. \"A token this library mints is a token it verifies\" therefore holds CONDITIONALLY, and the declaration this row supplies is the condition.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: { iss: ISSUER, sub: "user-1", exp: NOW + 3600 },
        options: {
          header: { crit: ["x-lindorm-hint"] },
          custom: { header: { "x-lindorm-hint": "carried" } },
        },
      },
    ],
    when: [{ step: "verify", options: { critical: ["x-lindorm-hint"] } }],
    then: [
      { step: "accepts" },
      // BOTH halves on the wire, and the `crit` half is what makes this row about
      // a CRITICAL parameter rather than merely a carried one: without it the row
      // would stay green if the mint dropped the crit member entirely, which is
      // exactly the failure the round trip exists to exclude.
      //
      // The parameter rides under its own key on BOTH encodings — a tstr label on
      // COSE, since an unregistered parameter has no integer one — and `crit`
      // names it in that same spelling (`critToCoseLabels` leaves an unregistered
      // member as its own tstr label).
      //
      // ⚠ The PARAMETER is spelled identically on both wires; `crit` is not — it
      // is a REGISTERED parameter, so COSE keys it by its integer label 2
      // (RFC 9052 §3.1) while JOSE uses the name. The raw-bytes steps compare
      // in each wire's own vocabulary, so the two halves are stated per wire.
      {
        step: "wireProtectedHeader",
        includes: { "x-lindorm-hint": "carried" },
      },
      {
        step: "wireProtectedHeader",
        on: "jose",
        includes: { crit: ["x-lindorm-hint"] },
      },
      {
        step: "wireProtectedHeader",
        on: "cose",
        includes: { 2: ["x-lindorm-hint"] },
      },
    ],
  },
  {
    id: "a-critical-custom-parameter-is-refused-until-the-caller-declares-it",
    title:
      "a token marking a custom header parameter critical is refused from a verifier that has not claimed it",
    rationale:
      "A listed extension header parameter the recipient does not understand invalidates the token on JOSE (RFC 7515 §4.1.11). ⚠ The same refusal on COSE is AEGIS POLICY, not a citation: RFC 9052 §3.1 attaches no such consequence. The duty belongs to the RECIPIENT, and a verification library is never the final recipient: it verifies on an application's behalf and cannot know what that application implements. Carriage answers a different question — a producer supplying a parameter says nothing about whether the reader understands it — so accepting on carriage alone leaves the duty unenforced for every extension a specification does not define, which is the whole set `crit` exists for. Refusing until the parameter is claimed is the only reading under which the requirement means anything, and it fails closed: a verifier that says nothing gets the strict answer.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: { iss: ISSUER, sub: "user-1", exp: NOW + 3600 },
        // The producer half is legal on both wires — this is the token the mint
        // gate emits, which is what makes the refusal a statement about the
        // RECIPIENT rather than about the bytes.
        options: {
          header: { crit: ["x-lindorm-hint"] },
          custom: { header: { "x-lindorm-hint": "carried" } },
        },
      },
    ],
    // No `crit` option: the verifier declares nothing.
    when: [{ step: "verify" }],
    // The refusal names the MEMBER in `data.param`, not the whole list — a
    // producer acting on the verdict has to know which parameter was not honoured.
    then: [
      {
        step: "rejects",
        on: "jose",
        error: "JwtError",
        code: "jwt_unsupported_crit_param",
        data: { param: "x-lindorm-hint" },
      },
      {
        step: "rejects",
        on: "cose",
        error: "CwtError",
        code: "cwt_unsupported_crit_param",
        data: { param: "x-lindorm-hint" },
      },
    ],
  },
  {
    id: "a-crit-declaration-does-not-substitute-for-the-parameter-being-carried",
    title:
      "declaring a critical parameter does not make a token that omits it verifiable",
    rationale:
      "A `crit` naming a parameter the protected header does not carry is a fatal processing error on COSE (RFC 9052 §3.1); on JOSE a producer may not write one and a recipient may treat a token that does as invalid (RFC 7515 §4.1.11), and aegis takes that recipient option. The declaration and the presence rule answer different questions: one says the recipient will act on the parameter, the other says the issuer actually stated it. A declaration that waived presence would let a verifier turn a malformed token into a valid one by naming the missing parameter, which is the verifier deciding what the issuer wrote.",
    given: [
      {
        step: "token",
        via: "foreign",
        claims: { iss: ISSUER, sub: "user-1", aud: [RESOURCE], exp: NOW + 3600 },
        // A FOREIGN producer, because aegis's own mint gate refuses this shape
        // before it reaches the wire
        // (`src/internal/header/assert-crit-satisfied.ts#export const assertCritSatisfied`).
        // ⚠ On JOSE the foreign producer HAND-ASSEMBLES the compact serialisation
        // rather than going through `jose`, which refuses to write this header at
        // sign time. Both encodings therefore reach the read gate, which is what
        // the row is about: `src/internal/utils/validate-crit.ts#export const validateCrit`
        // is wire-agnostic.
        buckets: { protectedHeader: { crit: ["x-lindorm-hint"] } },
      },
    ],
    when: [{ step: "verify", options: { critical: ["x-lindorm-hint"] } }],
    // MALFORMED, not unsupported: the fault is the header, not the recipient.
    then: [
      { step: "rejects", on: "jose", error: "JwtError", code: "jwt_invalid_crit" },
      { step: "rejects", on: "cose", error: "CwtError", code: "cwt_invalid_crit" },
    ],
  },
  {
    id: "a-crit-declaration-does-not-admit-a-specification-defined-parameter",
    title:
      "a verifier cannot take responsibility for a critical parameter the specification itself defines",
    rationale:
      "A producer may not name a specification-defined parameter in `crit` (RFC 7515 §4.1.11), so there is no conformant token for a recipient to accept. The declaration transfers the duty to UNDERSTAND an extension; it is not a waiver of the rules about what may be named, and reading it as one would let any verifier opt back into the exact shape the specification prohibits. A parameter the specification defines already has a meaning every recipient can look up, so marking it critical asserts a meaning beyond that one — which is precisely what no recipient can obtain, declaration or not.",
    given: [
      {
        step: "token",
        via: "foreign",
        claims: { iss: ISSUER, sub: "user-1", aud: [RESOURCE], exp: NOW + 3600 },
        // `cty` is carried BESIDE the `crit` naming it, so the header is
        // otherwise well-formed and the refusal can only be about the member
        // being specification-defined.
        buckets: { protectedHeader: { crit: ["cty"], cty: "application/json" } },
      },
    ],
    when: [{ step: "verify", options: { critical: ["contentType"] } }],
    then: [
      { step: "rejects", on: "jose", error: "JwtError", code: "jwt_invalid_crit" },
      { step: "rejects", on: "cose", error: "CwtError", code: "cwt_invalid_crit" },
    ],
  },
  {
    id: "a-crit-declaration-does-not-reach-the-unprotected-bucket",
    title:
      "declaring a critical parameter does not admit one that rides the unsigned COSE bucket",
    rationale:
      "Every critical parameter must be integrity-protected (RFC 9052 §3.1), because a parameter the signature does not cover is one any holder in the path could have written. A recipient declaring that it will act on the parameter makes that worse rather than better: it is now committed to honouring a value an intermediary chose. So the bucket rule is prior to the declaration, and the reader consults the protected bucket alone when deciding whether the header carries what its `crit` names.",
    given: [
      {
        step: "token",
        via: "foreign",
        claims: { iss: ISSUER, sub: "user-1", aud: [RESOURCE], exp: NOW + 3600 },
        buckets: {
          protectedHeader: { crit: ["x-lindorm-hint"] },
          unprotectedHeader: { "x-lindorm-hint": "advisory" },
        },
      },
    ],
    when: [{ step: "verify", options: { critical: ["x-lindorm-hint"] } }],
    then: [{ step: "rejects", error: "CwtError", code: "cwt_invalid_crit" }],
    unsupported: {
      jose: "the JOSE compact serialisation has ONE header and it is protected (RFC 7515 §7.1) — there is no unsigned bucket for a parameter to ride",
    },
  },
  {
    id: "the-crit-declaration-is-accepted-at-the-wire-verify-door",
    title:
      "the raw wire verify door takes the same critical-parameter declaration the domain door does",
    rationale:
      "A caller reaches the same rule through two doors — the domain verb and the raw wire namespace — and a declaration honoured at one and dropped at the other is invisible: the caller states it, sees no error, and the token is refused anyway. The duty sits with the recipient rather than with a tier (RFC 7515 §4.1.11), so which door an application happens to use cannot decide whether it is allowed to claim an extension. One meaning, both tiers.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: { iss: ISSUER, sub: "user-1", exp: NOW + 3600 },
        options: {
          header: { crit: ["x-lindorm-hint"] },
          custom: { header: { "x-lindorm-hint": "carried" } },
        },
      },
    ],
    when: [
      { step: "kit-verify", kit: "structured", options: { crit: ["x-lindorm-hint"] } },
    ],
    then: [{ step: "accepts" }],
  },
  {
    id: "an-opaque-signature-s-critical-custom-parameter-is-declarable-at-its-own-door",
    title:
      "the opaque wire verify door takes the critical-parameter declaration for a signature over arbitrary octets",
    rationale:
      "An opaque signature carries the same critical-parameter rule a claims token does: neither the signature's reach nor the recipient's duty turns on the payload being a claim set (RFC 7515 §1, RFC 7515 §4.1.11). The opaque SIGNING door can write a critical custom header parameter, so a matching verify door that cannot be told about one would make the library refuse its own output on that surface alone; the only escape would be to re-issue the artifact through a claims door, which changes what the token IS rather than what the recipient understands. A declaration has to be statable wherever the shape is producible.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "opaque",
        claims: { tid: "at_abc", scope: "openid" },
        options: {
          header: { crit: ["x-lindorm-hint"] },
          custom: { header: { "x-lindorm-hint": "carried" } },
        },
      },
    ],
    when: [{ step: "kit-verify", kit: "opaque", options: { crit: ["x-lindorm-hint"] } }],
    then: [
      { step: "accepts" },
      // BOTH halves on the wire, for the reason the structured twin states: an
      // `accepts` alone would stay green if the OPAQUE signing door dropped
      // `header.crit` or the custom bag, since a token carrying neither verifies
      // for any caller. The declaration is only worth stating at this door if the
      // door writes the shape that needs it. Same spellings as the twin: the
      // parameter under its own key on both encodings, `crit` by name on JOSE and
      // by its integer label 2 on COSE (RFC 9052 §3.1).
      { step: "wireProtectedHeader", includes: { "x-lindorm-hint": "carried" } },
      {
        step: "wireProtectedHeader",
        on: "jose",
        includes: { crit: ["x-lindorm-hint"] },
      },
      { step: "wireProtectedHeader", on: "cose", includes: { 2: ["x-lindorm-hint"] } },
    ],
  },
  {
    id: "a-sealed-token-s-critical-custom-parameter-needs-the-same-declaration",
    title:
      "an encrypting outer marking a custom header parameter critical is read only by a caller that declares it",
    rationale:
      "An encrypting outer carries a header exactly as a signed one does, and `crit` means the same thing on a JWE as on a JWS (RFC 7516 §4.1.13, RFC 7515 §4.1.11). A library whose sealing door can WRITE a critical custom parameter and whose opening door cannot be told about one refuses the tokens it produces itself, so the declaration has to reach the decrypt door and not the verify door alone. It is the same rule, on the surface where confidentiality rather than authenticity is the point.",
    given: [
      { step: "keys", keys: ["ec-enc", "oct-enc"] },
      {
        step: "token",
        via: "kit-encrypt",
        kit: "sealed",
        data: "sealed-plaintext",
        options: {
          header: { crit: ["x-lindorm-hint"] },
          custom: { header: { "x-lindorm-hint": "carried" } },
        },
      },
    ],
    when: [{ step: "decrypt", options: { critical: ["x-lindorm-hint"] } }],
    then: [{ step: "accepts" }],
  },
  {
    id: "a-critical-refusal-names-the-parameter-it-objects-to",
    title:
      "a refusal of a critical-parameter list names the parameter the library cannot honour",
    rationale:
      "A producer may mark SEVERAL parameters critical at once (RFC 7515 §4.1.11), and only some of them may be nameable there. The refusal returned is the only part of the verdict a caller can act on, so it has to name the parameter actually objected to rather than whichever happens to be listed first. Naming the first member instead tells the caller to remove a parameter that was perfectly legal while leaving the forbidden one in place: the next call is refused for the same reason, and the diagnosis has cost a round trip while pointing away from the defect. It is the same property that makes any refusal worth returning — a message that misidentifies its cause is worse than a bare rejection, because it is acted upon.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: { iss: ISSUER, sub: "user-1", exp: NOW + 3600 },
        // `oid` is listed FIRST deliberately: it is the member aegis permits — a
        // critical extension it implements — so a refusal naming it would be
        // naming the wrong one. `alg` is a specification-defined name and so
        // forbidden outright (RFC 7515 §4.1.11); it is the one the verdict must
        // name.
        options: { header: { crit: ["oid", "alg"], oid: "1.2.3.4" } },
      },
    ],
    when: [{ step: "mint" }],
    // ONE gate, both wires, and the refusal carries the whole list beside the
    // offending member so a caller can see which of the two it names. The classes
    // sit at the SAME DEPTH of the error tree — `CwtError` is the leaf
    // `JwtError`'s counterpart, not `CoseError`, which is the family root and
    // would accept any COSE refusal whatsoever.
    then: [
      {
        step: "rejects",
        on: "jose",
        error: "JwtError",
        data: { crit: ["oid", "alg"], parameter: "alg" },
      },
      {
        step: "rejects",
        on: "cose",
        error: "CwtError",
        data: { crit: ["oid", "alg"], parameter: "alg" },
      },
    ],
  },
  {
    id: "a-producer-may-mark-an-implemented-extension-parameter-critical",
    title:
      "a token marking a header parameter the library implements critical is minted, and verified by a caller that declares it",
    rationale:
      "`crit` is a producer's one way to say that a recipient is required to understand a header parameter, on either wire (RFC 7515 §4.1.11, RFC 9052 §3.1). Both are worthless to a library that refuses every such token, INCLUDING ITS OWN OUTPUT: a producer and a verifier running the same library must agree, or the library mints tokens it will not read back and the mechanism cannot be used at all. So a parameter the library implements as an extension is one it can be told to insist on, and one it honours the insistence about — which means carrying the parameter through to the verified header, where the application can act on it. The parameter has to be one no specification already defines, because `crit` may not name those (RFC 7515 §4.1.11); `oid` is the only such parameter this library owns.",
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
    // VERIFY, not merely mint, and that is the whole capability: a `crit` that
    // mints and then cannot be verified at all is worse than no `crit`, because
    // the failure lands on the recipient rather than the producer. The
    // declaration is what makes the round trip completable — `oid` gets no
    // exception, because aegis registering a parameter says nothing about whether
    // the application behind it can act on one.
    when: [{ step: "verify", options: { critical: ["objectId"] } }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      // Reported in DOMAIN vocabulary, which is the round trip: the member is
      // written as the wire name `oid`, travels as the label its own wire keys
      // the parameter under (RFC 9052 §1.5), and comes back as `objectId` beside
      // the value it names. An application told to understand the parameter can
      // only do so if it is handed it.
      {
        step: "header",
        expected: { critical: ["objectId"], objectId: "1.2.3.4" },
      },
    ],
  },
  {
    id: "an-implemented-extension-parameter-still-needs-the-recipients-declaration",
    title:
      "a token marking the library's own extension critical is refused from a verifier that has not claimed it",
    rationale:
      "A token is invalid when a listed extension header parameter is not understood and supported by the recipient, on JOSE (RFC 7515 §4.1.11). ⚠ The same refusal on COSE is AEGIS POLICY, not a citation: RFC 9052 §3.1 attaches no such consequence. THE RECIPIENT is the party named, and a verification library is not it — it verifies on an application's behalf and cannot know what that application implements. That a library REGISTERS a parameter, translates it and reports it says only that the library can carry the value; it says nothing about whether the application receiving that value can act on it. So a registered extension is on exactly the same footing as an issuer's own: both are refused until the caller states that it takes the parameter on. An exception for the library's own parameter would be the one case where the duty is discharged by the party that cannot discharge it.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: { iss: ISSUER, sub: "user-1", exp: NOW + 3600 },
        // The producer half is legal: `oid` is the registry's one crit-eligible
        // parameter, so this is a token the mint gate emits.
        options: { header: { crit: ["oid"], oid: "1.2.3.4" } },
      },
    ],
    when: [{ step: "verify" }],
    then: [
      {
        step: "rejects",
        on: "jose",
        error: "JwtError",
        code: "jwt_unsupported_crit_param",
        data: { param: "oid" },
      },
      {
        step: "rejects",
        on: "cose",
        error: "CwtError",
        code: "cwt_unsupported_crit_param",
        data: { param: "oid" },
      },
    ],
  },
  {
    id: "the-wire-verify-door-declares-a-registered-extension-by-its-wire-name",
    title:
      "the raw wire verify door claims the library's own extension under the name the header carries",
    rationale:
      "A wire door speaks the wire's vocabulary in every direction — the header it reports, the `crit` it reads, and the declaration it takes. A door that reported a parameter under one spelling and demanded another to accept it would make the caller hold two names for one thing, and the mismatch is silent: the declaration simply fails to match and the token is refused as though nobody had claimed it. So the declaration is spelled exactly as the member the reader is comparing it against.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: { iss: ISSUER, sub: "user-1", exp: NOW + 3600 },
        options: { header: { crit: ["oid"], oid: "1.2.3.4" } },
      },
    ],
    when: [{ step: "kit-verify", kit: "structured", options: { crit: ["oid"] } }],
    then: [{ step: "accepts" }],
  },
  {
    id: "the-domain-door-refuses-a-critical-declaration-in-wire-vocabulary",
    title:
      "the domain verify door refuses a critical-parameter declaration spelled in wire names",
    rationale:
      "The domain tier exists so a caller never has to learn either encoding's vocabulary: every value it takes is stated in aegis names, and the crossing translates them. A door that ALSO accepted the wire spelling would speak two vocabularies at once — one name for a parameter in the header bag it hands back, another admitted in the declaration — and a caller reading one surface would write the other. The refusal is the mirror of a wire door refusing a domain-spelled `crit` member, and together they keep one name meaning one thing per tier.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: { iss: ISSUER, sub: "user-1", exp: NOW + 3600 },
        options: { header: { crit: ["oid"], oid: "1.2.3.4" } },
      },
    ],
    // `oid` is the WIRE spelling; the domain name is `objectId`.
    when: [{ step: "verify", options: { critical: ["oid"] } }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        code: "crit_declaration_not_domain_named",
        data: { parameter: "oid", expected: "objectId" },
      },
    ],
  },
  {
    id: "a-specification-defined-header-parameter-cannot-be-marked-critical",
    title:
      "a mint refuses a critical-parameter list naming a parameter the specification itself defines",
    rationale:
      "A producer may not name a specification-defined parameter in `crit`, and a recipient may treat a token that does as invalid (RFC 7515 §4.1.11). The prohibition earns itself — such a `crit` adds no information, because every implementation already understands the parameter, and it costs conformance. The producer is therefore strictly worse off than if it had said nothing. ⚠ Holding COSE to the same refusal is AEGIS POLICY: RFC 9052 §3.1 puts the low integer labels an implementation already handles under a SHOULD-omit rather than a prohibition. The refusal belongs at the WRITE, which is the last point at which the producer can still choose differently.",
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
        // `alg` is the sharpest member available: REQUIRED on every token, so the
        // header always carries it and the refusal cannot be mistaken for the
        // separate rule about a `crit` naming a parameter the header lacks.
        options: { header: { crit: ["alg"] } as never },
      },
    ],
    when: [{ step: "mint" }],
    // ONE verdict on both wires. The `data` names the member, which is what ties
    // the refusal to this rule rather than to any other throw the build makes.
    then: [{ step: "rejects", error: "AegisError", data: { parameter: "alg" } }],
  },
  {
    id: "a-header-parameter-cannot-be-marked-critical-twice",
    title: "a mint refuses a critical-parameter list that names the same parameter twice",
    rationale:
      "A producer may not repeat a name in `crit` (RFC 7515 §4.1.11). The prohibition earns itself, because a repeat states nothing the first mention did not: `crit` lists the parameters a recipient must understand, and a recipient that understands a parameter understands it once. What the repeat DOES cost is conformance — the token is malformed for every recipient that applies the rule, including the ones that would otherwise have honoured the extension, so the producer is strictly worse off than if it had said nothing. The refusal belongs at the WRITE, which is the last point at which the producer can still choose differently; by the time a recipient sees it, the only choice left is whether to reject.",
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
        // `oid` is the member that makes this row REPRODUCE the rule rather than
        // agree with it by accident: it is the one parameter a producer may
        // legitimately mark critical, so the ONLY thing wrong with this header is
        // the repetition. A duplicate of any other name would be refused for
        // being that name, and the row would state nothing about duplicates.
        options: { header: { crit: ["oid", "oid"], oid: "1.2.3.4" } },
      },
    ],
    // MINT is the act: a producer may not repeat a name while a recipient may
    // accept one anyway (RFC 7515 §4.1.11) — so the refusal aegis owes is at the
    // write, and a foreign token carrying a duplicate is deliberately still
    // accepted.
    when: [{ step: "mint" }],
    // ⚠ ONE VERDICT ON BOTH WIRES. The gate runs on the caller's wire-named bag
    // upstream of either wire's label translation, so nothing about the encoding
    // reaches it. The `data` pins BOTH the repeated member and the list that
    // repeats it — the list is what makes the verdict specific, since the other
    // malformed-crit refusal carries the same class and the same `{ crit,
    // parameter }` shape for a parameter the header gives no value for.
    then: [
      {
        step: "rejects",
        error: "AegisError",
        data: { crit: ["oid", "oid"], parameter: "oid" },
      },
    ],
  },
  {
    id: "a-wire-door-refuses-a-critical-member-spelled-in-domain-vocabulary",
    title:
      "a wire-named door refuses a critical-parameter list written in domain vocabulary",
    rationale:
      "A door takes ONE vocabulary. The wire doors take wire parameter names — that is what makes `aegis.jws.sign` and `aegis.cws.sign` the same call in two encodings — and a `crit` member is a parameter name like any other. A door that quietly accepted the domain spelling in that one position would resolve the same call two ways depending on the encoding: a COSE `crit` member is a LABEL, the very label its parameter is keyed under (RFC 9052 §3.1, RFC 9052 §1.5), so a member the JOSE door silently translated for the caller has no counterpart on the COSE wire and the identical call mints on one encoding and fails on the other. That is a difference a presenter chooses rather than the deployment. The domain door is where a domain name is translated, and it translates this one already — so nothing is lost by holding the wire door to its own vocabulary.",
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
        // Cast locally: `crit` is typed as `Array<string>`, so the domain
        // spelling compiles — the vocabulary is a runtime fact about the member,
        // not something the member's type can carry. `oid` IS supplied, so the
        // refusal is about the SPELLING and not about a missing parameter.
        options: { header: { crit: ["objectId"], oid: "1.2.3.4" } as never },
      },
    ],
    when: [{ step: "mint" }],
    then: [{ step: "rejects", error: "AegisError", data: { parameter: "objectId" } }],
  },
  {
    id: "the-domain-door-marks-a-parameter-critical-in-domain-vocabulary",
    title: "a domain-named mint marks a parameter critical using the domain name for it",
    rationale:
      "The domain tier is the surface a caller reaches when it does not want to know which encoding the token ends up in, so every value it takes is stated in aegis vocabulary — including a `crit` member, which is a parameter name and must therefore be spelled the way the same bag spells its keys. The crossing translates both together, so the member and the parameter it names can never disagree; a tier that translated the keys and not the members would emit a `crit` naming a parameter the token does not carry — a fatal processing error on COSE (RFC 9052 §3.1), and on JOSE a header a producer may not write and a recipient may treat as invalid (RFC 7515 §4.1.11).",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "access_token",
        content: {
          subject: "user-1",
          audience: [RESOURCE],
          clientId: CLIENT,
        },
        options: {
          sign: { header: { critical: ["objectId"], objectId: "1.2.3.4" } },
        },
      },
    ],
    when: [
      { step: "mint" },
      // The DECLARATION is in the same vocabulary as the mint's `critical`, which
      // is what this row is about: one spelling for the member on both sides of
      // the domain door.
      {
        step: "verify",
        profile: "access_token",
        options: { audience: RESOURCE, critical: ["objectId"] },
      },
    ],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      { step: "header", expected: { critical: ["objectId"], objectId: "1.2.3.4" } },
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
      "Expiry is stated by the registered `exp` claim and by nothing else (RFC 7519 §4.1.4, RFC 8392 §3.1.4). A presence check that an unregistered claim can satisfy merely by resembling the registered one lets a producer hand out a token with no enforceable lifetime, which the verifier then honours indefinitely.",
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
      "The aegis access-token floor requires `exp` to be PRESENT: a token that states no lifetime never expires, so a verifier has to refuse it outright rather than supply a default the issuer never authorised. `exp` is REQUIRED in a JWT access token, and the same claim rides the COSE wire (RFC 9068 §2.2, RFC 8392 §3.1.4). ⚠ Requiring it on the COSE encoding is AEGIS POLICY, not a citation: RFC 8392 §3.1 mandates no claim. A lifetime a verifier cannot enforce is the same hazard on either wire.",
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
      'OIDC Core makes `at_hash` REQUIRED exactly where an access token is co-issued from the authorization endpoint — OIDC Core §3.2.2.10 for the implicit flow and OIDC Core §3.3.2.11 for the hybrid flow, while OIDC Core §3.1.3.6, which defines the claim, marks it OPTIONAL. aegis applies the same rule wherever an access token co-issues. Whether one did is a fact only the issuer holds — it is not in the claims, and nothing about the token distinguishes "no access token was issued" from "the issuer forgot to say". Treating the unstated case as `false` therefore silently issues the exact token the rule exists to prevent, so the fact must be supplied rather than assumed.',
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
      'A rule reading a fact under a name nobody supplied evaluates the fact as absent, which for a boolean reads as false — so a misspelled key is not an error, it is a silent answer of "no". A supplied bag is therefore no evidence that the fact was supplied: the check has to be on the NAME the rule reads, or the guard against an omitted fact is defeated by any bag at all.',
    given: [
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: { subject: "user-1", audience: [CLIENT], accessToken: "at-1" },
        options: {
          // ⚠ LOCAL cast, deliberate: `SignContext` is a CLOSED record, so this
          // misspelling does not compile — which is the type-level half of the
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
  {
    id: "a-required-claim-supplied-as-an-empty-list-is-not-supplied",
    title: "minting a token whose required audience is an empty list is refused",
    rationale:
      "`aud` is the set of recipients a token is intended for (RFC 7519 §4.1.3), so an empty set names none of them: the token is addressed to nobody while reporting that it has an audience, and every recipient reading it finds itself excluded. A demand for a claim is a demand for its content, and a demand a container satisfies while holding nothing is enforced at scalar claims and open at every list- and object-valued one — which is the half of the vocabulary that carries the restrictions and the bindings.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "userinfo",
        content: { subject: "user-1", audience: [] },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: {
          direction: "mint",
          invalid: [{ key: "audience", message: 'Required claim "audience" is missing' }],
        },
      },
    ],
  },
  {
    id: "a-required-claim-whose-value-is-not-of-its-declared-type-is-refused-rather-than-minted-without-it",
    title: "minting a token whose required claim is not of its declared type is refused",
    rationale:
      "A demand for a claim is a demand for a value the token will carry, and a value the writer cannot carry satisfies nothing. Every registered claim declares the kind of value it holds, and the writer leaves off the wire a value its own reader would not read back — so a required claim supplied as the wrong kind would satisfy the demand at the policy gate and then be absent from the token, under a profile whose whole point is that it is there. The one caller who cannot notice is the one who supplied a value. The refusal names the fault as what it is — the value is not of its declared type, not missing — so the caller repairs the value instead of looking for a field they already wrote.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "access_token",
        // ⚠ THE CAST IS THE POINT. A well-typed caller cannot reach this class at
        // all, so the row reaches past the type to state the rule for the doors
        // that have no type behind them: a JavaScript caller, a value read from
        // a foreign source and handed on.
        content: {
          subject: 42 as unknown as string,
          audience: [CLIENT],
          clientId: CLIENT,
        },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      // ⚠ THE CODE, not merely the class: a structure refusal carries an `invalid`
      // list under the same class, so a row naming only the class would pass
      // whichever fired.
      {
        step: "rejects",
        error: "AegisDomainError",
        code: "profile_policy_invalid",
        data: {
          direction: "mint",
          invalid: [
            {
              key: "subject",
              message: 'Required claim "subject" is not of its declared type',
            },
          ],
        },
      },
    ],
  },
  {
    id: "a-demanded-confirmation-must-bind-a-key",
    title:
      "minting a sender-constrained token whose confirmation binds no key is refused",
    rationale:
      "`cnf` is the container for the confirmation members that identify the proof-of-possession key a presenter must demonstrate possession of, on either encoding (RFC 7800 §3.1, RFC 8747 §3), and a `cnf` holding no member names no key. A token issued that way is declared sender-constrained and is in fact a bearer token: a recipient checking the binding has nothing to check it against, so a stolen copy presents exactly as the legitimate holder does. A profile demanding a confirmation demands the binding, not the container.",
    given: [
      // No BUILT-IN profile requires `confirmation`, so the capability is stated
      // against a profile the row registers through the public `registerProfile`
      // door.
      {
        step: "profile",
        profile: {
          name: "sender_constrained",
          typ: { presence: "none" },
          policy: [
            {
              rule: "required",
              on: ["mint", "verify"],
              claims: ["subject", "audience", "confirmation"],
            },
            { rule: "shape", on: ["mint", "verify"], shape: "confirmation" },
          ],
          autoInject: ["issuedAt", "tokenId", "issuer"],
          issuer: "platform",
          lifetime: "5m",
          encryptable: false,
        },
      },
      {
        step: "token",
        via: "mint",
        profile: "sender_constrained",
        content: { subject: "user-1", audience: [RESOURCE], confirmation: {} },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: {
          direction: "mint",
          invalid: [
            { key: "confirmation", message: 'Required claim "confirmation" is missing' },
          ],
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
      "A relying party handed a logout token naming neither a `sub` nor a `sid` has nothing to terminate (OpenID Connect Back-Channel Logout 1.0 §2.4). The requirement is on the token a verifier RECEIVES, so it has to be checked at verify: a rule enforced only at mint constrains this issuer's own output and says nothing about the token that actually arrived.",
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
      "A `sub` alone satisfies the identification requirement (OpenID Connect Back-Channel Logout 1.0 §2.4). A floor that refused a logout token naming one would break every conformant back-channel logout, so the identification rule must reject exactly the tokens that identify nothing and no others.",
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
      "A domain rule is one rule, so it raises ONE code on both encodings; but a consumer handling that refusal — logging it, rendering it, deciding whether to retry against a different endpoint — still has to know which encoding the refused token was in. That fact therefore has to travel as DATA on the error, because it is not in the code. This is aegis policy, not a specification requirement: no RFC says anything about the shape of an implementation's error. A refusal that names the WRONG encoding is worse than one that names none: it sends whoever reads it to the wrong decoder, the wrong issuer and the wrong half of the code, and it does so most convincingly when both wires share the one implementation that produced it.",
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
      "A COSE object has two header buckets and the `kid` hint may ride the unprotected one (RFC 9052 §3, RFC 9052 §3.1). A caller reading a verified token must still be told which key identifier the token carried, and must be told it the same way on both wires: the JOSE compact serialisation has no second bucket (RFC 7515 §7.1), so a domain surface that reported the COSE `kid` under a bucket name of its own would make the same fact unreadable in one place on one wire and another place on the other. `kid` is on the SHORT list of parameters the header registry permits to travel unauthenticated, which is what makes admitting it safe: it names a key, and the key is then proven by the signature rather than believed.",
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
      "A JWT has exactly one header (RFC 7515 §7.1) and the signature covers all of it (RFC 7515 §5.2), so the domain header's provenance question is settled by the serialisation itself: there is no second bucket for an unauthenticated parameter to arrive from. This is what makes ONE domain header the honest shape on this wire — a second, permanently empty bucket beside it would invite a reader to ask which of the two a value came from when the wire admits only one answer.",
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
    id: "a-registered-header-parameter-cannot-be-carried-as-a-custom-one",
    title:
      "a header parameter the library knows is refused from the custom unprotected bucket",
    rationale:
      "The custom bag exists to carry parameters NO specification defines, and the registered bag exists to carry the ones that do — one question per field. A registered name accepted into `custom` would collapse that: the parameter would travel raw, past the value codec its registry row states and past the bucket its `placement` cell assigns, while a reader gave it the meaning its specification assigns. The caller would have written something that looks like the parameter and behaves like nothing. Refusing at the call site names the mistake where it is made, and the door that does accept it is one field away. The rule is the NAME and not the bucket — what makes a parameter inadmissible is that it is defined, not where the caller tried to put it — and this row runs the UNPROTECTED half, which is the bucket a caller is likeliest to reach for. The protected half of the same rule is stated at `src/internal/header/custom-header-params.test.ts#the JOSE doors refuse a REGISTERED name in custom.header`.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: { iss: ISSUER, sub: "user-1", exp: NOW + 3600 },
        // `cty` is caller-settable and NOT kit-derived, so the refusal can only
        // be the registered-in-custom rule: a kit-owned parameter would be
        // refused by the sibling rule instead and the row would prove that one
        // twice. The `unprotected` bucket is named because it is the one a caller
        // might think the parameter belongs in — the answer is that neither does.
        options: { custom: { unprotected: { cty: "application/example" } } },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      {
        step: "rejects",
        error: "CoseError",
        code: "header_registered_in_custom",
        data: { parameter: "cty", bucket: "unprotected" },
      },
    ],
    unsupported: {
      jose: "the JOSE compact serialisation has no unprotected bucket for a parameter to be written into (RFC 7515 §7.1), so `JoseWireTokenEnvelope` declares no `custom.unprotected` at all — a JOSE kit door refuses the shape at COMPILE time, and the interpreter refuses an agnostic row that states it on the JOSE leg (`run-scenario.ts#joseOptionsOf`) rather than signing a token that ignores it. The NAME rule itself holds on both wires and is stated for JOSE by the sibling `custom.header` rows in `internal/header/custom-header-params.test.ts`",
    },
  },
  {
    id: "an-unauthenticated-parameter-cannot-restate-a-signed-one",
    title:
      "a parameter stated in both header buckets is reported as the issuer signed it",
    rationale:
      "The protected bucket is covered by the signature and the unprotected one is not (RFC 9052 §3), so where BOTH state the same parameter only one of the two values has an author a verifier can name. The signed value must therefore win, unconditionally and in that direction: resolving the other way — or by which bucket happens to be read first — would let whoever last held the token overwrite a statement its issuer signed, which is the whole property the protected bucket exists to provide.",
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
        buckets: { protectedHeader: { kid: "key_the_issuer_signed" } },
      },
    ],
    when: [{ step: "verify" }],
    then: [
      { step: "accepts", format: "cwt" },
      // ⚠ The token VERIFIES, and that is what makes the row about the merge and
      // not about key resolution: `kid` is a routing hint (RFC 9052 §3.1), so
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
      'A parameter a verifier routes, audits or polices a token by is only worth reading if the issuer said it. `kid` may ride the unprotected bucket (RFC 9052 §3.1); the parameters a verifier DECIDES by may not, and a reader that surfaced them anyway would let whoever last held the token declare what the token IS: its type (RFC 9596 §2), the type of its payload, the certificate it is attributable to, or an object identifier an application authorises against. ⚠ The CERTIFICATE half of that list is AEGIS POLICY, not a placement the specification makes: RFC 9360 §2 permits `x5chain` and `x5t` in either bucket — but aegis BINDS on the thumbprint (`src/internal/header/header-registry.ts#so PRESENCE IS THE BINDING`) and pins the certificate parameters PROTECTED, so an unprotected one is a certificate reference whoever last held the token can rewrite. aegis therefore denies the shape on both sides, and the two sides do it by different mechanisms because they face different producers. On WRITE there is no bag to put a registered parameter in unprotected at all: `custom.unprotected` is the only one a caller can fill and it refuses every registered name outright — `header_kit_owned_in_custom` for the names the kit derives from the key or the crypto operation, which it asks about first, and `header_registered_in_custom` for the rest — which is strictly stronger than a placement rule. On READ the header registry\'s `placement` column IS the allowlist, and it has to be — a foreign producer is under no such constraint — so a parameter declared `"protected"` that arrives unauthenticated is dropped before the domain header is built.',
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
        buckets: {
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
      "The `typ` header parameter declares the media type of the complete token (RFC 7519 §5.1), so a caller asserting a token IS of a given type is asserting on that whole media type. The comparison has to be made on the whole of it: a type whose media type is the bare conventional form — an id token is a plain `JWT` — has no structured prefix, so a check that compares prefixes has nothing to compare for exactly that type and silently accepts every token instead. An assertion that cannot fail is worse than an absent one, because the caller has stopped checking. COSE has the same parameter, at label 16 (RFC 9596 §2, RFC 9596 §4.1), so the caller's assertion means the same thing on that wire and must be enforced just as hard. An assertion honoured on one encoding and skipped on the other is an assertion the attacker chooses to be bound by, since the encoding is the issuer's choice and the presenter's opportunity.",
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
      "The type assertion must refuse exactly the tokens of another type and no others. An id token's media type is the bare conventional `JWT` (RFC 7519 §5.1), so a comparison that got this wrong in the other direction — demanding a structured media type an id token never carries — would refuse every conformant id token in existence. That bare media type has one COSE equivalent, `application/cwt` (RFC 8392 §9.2), so the assertion must accept exactly that and no other there. Getting the accepting half wrong is how a type check is discovered to be too strict only in production, by a deployment whose tokens were conformant all along.",
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
      // LABEL 16 (RFC 9596 §4.1), which CBOR keeps distinct from the
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
    id: "the-scope-claim-crosses-both-wires-as-one-space-delimited-string",
    title:
      "a minted scope reaches the wire as a single space-delimited string on either encoding",
    rationale:
      "The value of the `scope` claim is a JSON string containing a space-separated list of scopes (RFC 8693 §4.2), and the CWT registration carries the same value as a text string under its own claim key (RFC 9200 §8.14) — so the list is the DOMAIN'S vocabulary and the one string is the wire's, on both encodings. A recipient is written against the registered wire form: an array put there instead parses only for readers that tolerate an unregistered spelling, and every token carrying one teaches its consumers to accept a shape no specification defines.",
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
    when: [{ step: "mint" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      // aegis keys `scope` at COSE integer label 9 (RFC 9200 §8.14), so the two
      // wires spell the claim differently while carrying the same string.
      { step: "wireClaims", on: "jose", includes: { scope: "read write" } },
      { step: "wireClaims", on: "cose", includes: { 9: "read write" } },
    ],
  },
  {
    id: "a-scope-member-containing-a-space-is-refused-at-mint",
    title: "minting a token whose scope list has a member containing a space is refused",
    rationale:
      "The wire form of `scope` is one space-delimited string, so a domain member containing a space joins to bytes indistinguishable from two members, and every reader of the token — this package's own included — reports a list the caller never stated. Aegis policy at mint (RFC 6749 §3.3): the member is refused, and the refusal names its position so the caller repairs the value rather than the claim. The specification governs verify, so a foreign token's wire string is read as the members it delimits.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "access_token",
        content: {
          subject: "user-1",
          audience: [RESOURCE],
          clientId: CLIENT,
          scope: ["read write"],
        },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      // ⚠ THE CODE, not merely the class: a policy refusal carries an `invalid`
      // list under the same class, so a row naming only the class would pass
      // whichever fired.
      {
        step: "rejects",
        error: "AegisDomainError",
        code: "claim_structure_invalid",
        data: {
          claim: "scope",
          invalid: [
            { key: "scope[0]", message: 'Member "scope[0]" must not contain a space' },
          ],
        },
      },
    ],
  },
  {
    id: "a-demanded-scope-member-containing-a-space-is-refused-as-malformed-not-as-missing",
    title:
      "minting under a profile that demands a scope refuses a member containing a space for its shape, not its presence",
    rationale:
      "A profile demanding `scope` is satisfied by the caller who supplied one, so the fault in a member containing a space is the member's shape and nothing else — aegis policy at mint (RFC 6749 §3.3). The refusal must say so: a caller told the claim is missing, or not of its declared type, looks for a field they already wrote, while one told which member is malformed repairs it. The presence gate therefore reports nothing for a list whose one fault is a member, and the structure refusal naming the position is the one the caller sees.",
    given: [
      // No BUILT-IN profile requires `scope`, so the capability is stated against
      // a profile the row registers through the public `registerProfile` door.
      {
        step: "profile",
        profile: {
          name: "scoped_access",
          typ: { presence: "none" },
          policy: [
            {
              rule: "required",
              on: ["mint", "verify"],
              claims: ["subject", "audience", "scope"],
            },
          ],
          autoInject: ["issuedAt", "tokenId", "issuer"],
          issuer: "platform",
          lifetime: "5m",
          encryptable: false,
        },
      },
      {
        step: "token",
        via: "mint",
        profile: "scoped_access",
        content: { subject: "user-1", audience: [RESOURCE], scope: ["read write"] },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      // ⚠ THE CODE is the capability: `profile_policy_invalid` carries an `invalid`
      // list under the same class, and it is the refusal this row states does NOT
      // fire.
      {
        step: "rejects",
        error: "AegisDomainError",
        code: "claim_structure_invalid",
        data: {
          claim: "scope",
          invalid: [
            { key: "scope[0]", message: 'Member "scope[0]" must not contain a space' },
          ],
        },
      },
    ],
  },
  {
    id: "a-scope-matcher-is-answered-by-the-list-the-wire-string-spells",
    title:
      "a caller asserting one scope is answered by the space-delimited wire claim containing it",
    rationale:
      "A single scope named at verify is a containment question about the list the token grants — the same question the static matcher answers over a claim dict. On the wire that list is one space-separated string (RFC 8693 §4.2), so the matcher must be answered against the list the string spells: answered against the string itself, containment fails for every token whose grant should satisfy it, and the deployment's gate refuses every request at the one call site it believes is doing the gating.",
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
    when: [{ step: "mint" }, { step: "verify", assert: { scope: "read" } }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      { step: "claims", expected: { scope: ["read", "write"] } },
    ],
  },
  {
    id: "a-lindorm-authority-list-crosses-the-wire-as-the-array-it-is",
    title:
      "a minted roles claim reaches the wire as the array of strings it was stated as",
    rationale:
      "`roles` is encoded per SCIM guidance — an array of strings — and no string form is provided for it (RFC 9068 §2.2.3.1), so the array IS the registered wire shape. A space-joined spelling here would put a format no specification defines on a signed token, and a reader splitting one would invent list boundaries the issuer never wrote: the space-delimited form belongs to `scope`'s own registration (RFC 8693 §4.2) and to nothing beside it.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "access_token",
        content: {
          subject: "user-1",
          audience: [RESOURCE],
          clientId: CLIENT,
          roles: ["role-a", "role-b"],
        },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      // `roles` has only a lindorm PRIVATE-USE integer label and mint is
      // interoperable by default, so the claim rides both wires under its
      // registered string name — one spelling, one unscoped step.
      { step: "wireClaims", includes: { roles: ["role-a", "role-b"] } },
    ],
  },
  {
    id: "a-verified-result-carries-the-untranslated-wire-claims",
    title: "a verified token carries the claims exactly as they arrived on the wire",
    rationale:
      "A consumer that forwards, re-emits or logs a token must be able to reproduce what it received, and the domain claim buckets cannot answer that: they are the result of a translation that renames claims, splits them across buckets and decodes their values. The untranslated payload is the only place the exact received statement survives, so a result that omits it forces every such consumer to decode the token a second time — with a second decoder, which is where the two disagree. `scope` is the sharpest case: the wire carries one space-delimited string (RFC 8693 §4.2) while every domain surface speaks the list, so a matcher pass that lifts the string for its own comparison must leave the reported payload carrying the string the issuer signed.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "default",
        content: {
          subject: "user-1",
          expires: "1h",
          tokenType: "test_token",
          scope: ["read", "write"],
        },
      },
    ],
    when: [{ step: "mint" }, { step: "verify", assert: { scope: "read" } }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      {
        step: "untranslatedClaims",
        expected: { sub: "user-1", iss: ISSUER, scope: "read write" },
      },
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
      "A COSE_Mac0 and a COSE_Sign1 are different objects, with different tags and different security properties (RFC 9052 §6.2, RFC 9052 §4.2). A shared secret can only produce the first, so an encoder handed one must emit a COSE_Mac0 and the reader must report it as the MAC-authenticated form — a token whose structure says MAC while the result says signature would let a verifier believe a shared secret proved who issued it.",
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
      // Tag 17 is COSE_Mac0 and tag 18 is COSE_Sign1 (RFC 9052 §2). The
      // independent read is what distinguishes them — `format` is aegis
      // reporting its own decision about the same bytes.
      { step: "wireStructure", tags: [61, 17] },
    ],
    unsupported: {
      jose: "JOSE has no separate MAC structure to report: one structure carries both digital signatures and MACs (RFC 7515 §1), so a MAC-authenticated JOSE claims token is a JWS carrying an HMAC `alg` and reports as a `jwt`. There is no distinct format for the read side to name",
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
      jose: "JOSE has no separate MAC structure to read: one structure carries both digital signatures and MACs (RFC 7515 §1), so a MAC-authenticated JOSE claims token is a `jwt` and is already covered by the ordinary keyless read",
    },
  },
  {
    id: "a-signature-structure-refuses-a-symmetric-key",
    title:
      "a mint asked for the signature structure refuses a shared secret rather than emitting one",
    rationale:
      "A COSE_Sign1 carries a digital signature (RFC 9052 §4.2), whose whole property is that only the holder of the private key could have produced it. A shared secret has no such property — every party that can verify can also forge — so a structure that admitted one would make a signature and a MAC indistinguishable to the reader, which is the confusion the two separate structures exist to prevent. The refusal has to happen at issue: a token cannot be un-issued.",
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
      jose: "JOSE draws no such line to enforce: one structure carries both digital signatures and MACs (RFC 7515 §1), so an HMAC `alg` is a conformant JWS and a mint that refused it would refuse the conformant shape",
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
      "The signature is the only thing that says who issued a token, so a verifier that accepted one it could not validate would be accepting the presenter's word for every claim. A signature that does not validate makes the token invalid, on either wire (RFC 7515 §5.2, RFC 9052 §4.4).",
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
      "A temporal waiver states one thing — that this caller does not care when the token expires — and it must not be readable as a general instruction to trust the token less carefully. Authenticity and lifetime are independent properties: an unvalidated signature is fatal regardless of what the payload says (RFC 7515 §5.2), while `exp` is a claim ABOUT the payload (RFC 7519 §4.1.4). A waiver that leaked across the two would turn the id_token_hint flow, whose whole purpose is to accept an expired token on the strength of its signature, into a flow that accepts anything.",
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
      "A verifier's guarantee is that the claims it reads are the claims the issuer wrote, and that guarantee comes from the payload being covered by the integrity computation rather than merely travelling beside it. The payload sits INSIDE that computation on both wires (RFC 7515 §5.2, RFC 9052 §4.4). A payload outside it would let any holder grant itself a scope.",
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
      "The protected header is where a token states its algorithm, its key and its type, so a header a holder could edit would let the holder restate every one of them. The protected header sits inside the integrity computation on both wires (RFC 7515 §5.2, RFC 9052 §4.4) — which is precisely what makes the bucket PROTECTED and separates it from the unprotected one beside it.",
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
  // ⚠ THE TWO WIRES SPELL THE SAME BINDING WITH A DIFFERENT NUMBER OF PARAMETERS,
  // which is why several rows below are scoped per wire. JOSE names the digest
  // algorithm in the PARAMETER — `x5t` (SHA-1, RFC 7515 §4.1.7) beside
  // `x5t#S256` (SHA-256, RFC 7515 §4.1.8) — while COSE has ONE `x5t` (label 34)
  // whose value is a `COSE_CertHash` carrying its own `hashAlg` (RFC 9360 §2). A
  // CBOR map cannot
  // key one label twice, so a COSE token names its certificate by exactly one
  // digest and there is no legacy second one riding alongside it.
  //
  // Which digests ride is therefore the WIRE's answer and not the caller's: JOSE
  // emits both, COSE the one its `COSE_CertHash` carries, and no option chooses.
  // ---------------------------------------------------------------------------
  {
    id: "a-token-signed-with-a-certificate-bearing-key-declares-that-certificate",
    title:
      "a token signed by a key that carries a certificate chain names that certificate in its header",
    rationale:
      "A certificate binding is what lets a relying party tie a token to an identity a PKI already vouches for, rather than to a bare key it has no way to attribute. The parameters that name the certificate corresponding to the key that signed a token are defined on either wire (RFC 7515 §4.1.6, RFC 7515 §4.1.7, RFC 7515 §4.1.8; RFC 9360 §2 for `x5chain` at label 33 and `x5t` at label 34). ⚠ Emitting one whenever the signing key carries a chain is AEGIS POLICY: RFC 7515 §4.1.8 makes its use OPTIONAL. A key that HAS a chain and emits no binding leaves the relying party unable to make the attribution at all, and the caller no way to know it did not travel.",
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
    // `x5t` (SHA-1, RFC 7515 §4.1.7) beside `x5t#S256` (SHA-256,
    // RFC 7515 §4.1.8) — while COSE has a single `x5t` at label 34 whose value is
    // a `COSE_CertHash` (RFC 9360 §2). The digest algorithm is a MEMBER of the one
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
      "Asking for a certificate binding is a statement that the token must be attributable to a certificate, so a key that has none cannot honour the request. The two alternatives to refusing are both silent: emitting the token unbound leaves the issuer believing its tokens are attributable when they are not, and inventing a thumbprint would bind them to a certificate nobody holds. `x5t#S256` names the certificate corresponding to the signing key (RFC 7515 §4.1.8) — with no such certificate there is nothing the parameter could truthfully carry.",
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
  },
  // ---------------------------------------------------------------------------
  // Sign-then-encrypt.
  // ---------------------------------------------------------------------------
  {
    id: "a-sealed-claims-token-declares-its-nested-content-type",
    title:
      "a token sealed around a signed claims token declares that nesting in its envelope",
    rationale:
      "A nested token declares itself with `cty`, so a recipient knows to process the plaintext as a token rather than as opaque bytes (RFC 7519 §5.2, RFC 9052 §3.1). Without the declaration a reader holding the key recovers a byte string it has no reason to treat as a credential, and the inner signature — the only thing that says who issued the claims — is never checked.",
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
      {
        step: "accepts",
        format: { jose: "jwt", cose: "cwt" },
        wrapper: { jose: "jwe", cose: "cwe" },
      },
      // The same declaration in each wire's own vocabulary — the JOSE parameter
      // NAME against the COSE integer LABEL 3 (RFC 9052 §3.1), a different label
      // from the text `"3"` (RFC 9052 §1.5), and CBOR keys them apart.
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
      {
        step: "accepts",
        format: { jose: "jwt", cose: "cwt" },
        wrapper: { jose: "jwe", cose: "cwe" },
      },
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
        // One of each shape the empty prune drops, so a prune of any of them
        // shows here rather than only the one that happened to be written.
        //
        // ⚠ `nonce` is the member that makes the row REPRODUCE the rule rather
        // than agree with it. The other four are names the claim registry has
        // never heard of, and the prune stops at the edge of what aegis has
        // declared — so a payload made only of those could not have been pruned
        // whatever the verb decided. `nonce` IS declared, its cell says prune,
        // and its domain and JOSE spellings coincide, so it is the one key here
        // that reaches the decision under test.
        data: { blank: "", none: [], empty: {}, kept: "x", nonce: "" },
      },
    ],
    when: [{ step: "decrypt" }],
    then: [
      { step: "accepts", format: { jose: "jwe", cose: "cwe" } },
      {
        step: "raw",
        expected: { blank: "", none: [], empty: {}, kept: "x", nonce: "" },
      },
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
      "Explicit typing is what stops a token of one kind being taken for another (RFC 8725 §3.11), and an opaque signature and a claims token are exactly two such kinds: they are the same structure with different contents. The media type is the only thing distinguishing them before the payload is read, so an opaque artifact typed as a claims token would be handed to a claims reader that finds none — and a caller routing on the declaration would treat a handle as a credential.",
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
      // §4.1), which CBOR keeps distinct from the text label "16".
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
      "The keyless read is what a holder does to a token it did NOT issue — that is its whole purpose — so it cannot require a type header this package would have stamped. A claims token that declares no type is ordinary and conformant (RFC 7519 §5.1, RFC 9596 §2). A reader that routed on the header would answer 'not a token I recognise' for the majority of the third-party tokens it exists to inspect, and the holder would have no way to learn which key or issuer to ask about.",
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
      // covers. The COSE `typ` is label 16 (RFC 9596 §4.1).
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
      {
        step: "accepts",
        format: { jose: "jwt", cose: "cwt" },
        wrapper: { jose: "jwe", cose: "cwe" },
      },
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
      "The standard profile claims (`given_name`, `email`, …) are the ones an audience reads to learn about the end-user (OIDC Core §5.1), and the read side categorises them into a bucket of their own so a consumer can hand exactly that set to a rendering or provisioning path without re-deriving the categorisation. Write and read are separate code on each encoding, so a bucket one side fills and the other does not — or vice versa — loses the claims SILENTLY: the token mints, it verifies, and the values are simply gone, with no error on either side to say the caller's content was dropped.",
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
  {
    id: "an-address-reaches-the-wire-under-the-member-names-its-specification-defines",
    title: "an address is published under the member names its specification defines",
    rationale:
      "The address claim is defined entirely by its sub-fields, and their spellings ARE the interoperability contract (OIDC Core §5.1.1): a relying party reads `street_address` and knows nothing of any other name for it. The domain form is camelCase like every other claim, so a case conversion sits between the caller and the wire, and a conversion is exactly the kind of step that can be applied to one wire and not the other, or applied twice, or applied to a key that is an identifier rather than a field name. A token whose address members are misspelled round-trips through its own issuer perfectly and means nothing to anybody else, which is the failure mode that has no symptom on the issuing side.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: {
          subject: "user-1",
          audience: [CLIENT],
          profile: {
            address: {
              streetAddress: "Sample 1",
              postalCode: "00100",
              country: "SE",
              careOf: "Sample Recipient",
            },
          },
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
      // The WRITE half, in each wire's own vocabulary. On JOSE the members are
      // readable as a nested object; on COSE the claim rides its interoperable
      // string key (its integer label is private-use and emitted only in
      // proprietary mode), and the members inside it are text-keyed the same
      // way, which the raw byte pins in `classes/address-claim-wire.test.ts`
      // assert member by member on both wires.
      {
        step: "wireClaims",
        on: "jose",
        includes: {
          address: { street_address: "Sample 1", care_of: "Sample Recipient" },
        },
      },
      { step: "wireClaims", on: "cose", present: ["address"] },
      // The READ half. Either alone passes over the failure: a write that
      // misspelled a member and a read that expected the misspelling agree.
      {
        step: "bucket",
        bucket: "profile",
        expected: {
          address: {
            streetAddress: "Sample 1",
            postalCode: "00100",
            country: "SE",
            careOf: "Sample Recipient",
          },
        },
      },
    ],
  },
  {
    id: "an-address-member-no-specification-defines-still-reaches-the-recipient",
    title: "an address member no specification defines still reaches the recipient",
    rationale:
      "This is AEGIS POLICY, not a specification requirement, and it is stated rather than cited: the address member set is defined at OIDC Core §5.1.1 and BOUNDED to that set by OIDC Core §5.1, so carrying an unrecognised member is a DEPARTURE and not a gap the specification leaves open. The policy is that a declared member set is a floor and not a ceiling, because silently deleting a member a caller wrote is the worse of the two failures available — an address is a physical delivery instruction, a dropped line makes it undeliverable, and the caller gets no error and no way to discover the loss. Carrying it costs a recipient that does not recognise it nothing, because a recipient reads the members it knows. Whether any structured claim's member set should instead be CLOSED is a public-surface decision that has to be taken once for all of them rather than claim by claim, and until it is taken this is what aegis does.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: {
          subject: "user-1",
          audience: [CLIENT],
          profile: {
            address: {
              streetAddress: "Sample 1",
              buildingName: "Sample House",
            },
          },
        } as never,
        options: { context: { accessTokenIssued: false } },
      },
    ],
    when: [
      { step: "mint" },
      { step: "verify", profile: "id_token", options: { audience: CLIENT } },
    ],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      // The undeclared member keeps the mechanical key flip every unregistered
      // claim gets, so it is snake_case on the wire and camelCase on the way
      // back — the same treatment, one level in.
      {
        step: "wireClaims",
        on: "jose",
        includes: {
          address: { street_address: "Sample 1", building_name: "Sample House" },
        },
      },
      { step: "wireClaims", on: "cose", present: ["address"] },
      {
        step: "bucket",
        bucket: "profile",
        expected: {
          address: { streetAddress: "Sample 1", buildingName: "Sample House" },
        },
      },
    ],
  },
  {
    id: "a-null-claim-member-is-omitted-rather-than-refused",
    title:
      "a claim member whose value is null states nothing, and is omitted rather than refused",
    rationale:
      '`null` is how a database column, a JSON document and an unset optional all spell "there is no value here", so an issuer assembling a claim from such a source is stating the members it HAS, not asserting that the rest are null. A null member is therefore an ABSENCE, and neither of the two disposals that are not omission fits it. Refusing it turns the ordinary shape of a nullable row into an error the caller must strip out before every mint, which is work that buys the recipient nothing. Writing it puts a member on a signed wire whose value asserts nothing and which a reader typed against the declared shape cannot use. Absence already has a spelling on both wires — the member is not there — and that is what this reduces to. It is a different question from EMPTINESS: an empty string is a value a text member may hold, and whether it rides is what the registry\'s emptiness column decides. And it is the OPPOSITE question from conformance: a member holding a value that contradicts its declared shape is a statement this package cannot honour, while a null member is no statement at all.',
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          exp: NOW + 3600,
          // ⚠⚠ THE NULL MEMBER'S CODEC IS A **STRUCTURE**, and that is what makes
          // this row state its rule rather than a weaker one. A null at a TEXT
          // member is indistinguishable from a null the text codec merely failed
          // — both leave the member off — so a fixture built on one would pass
          // whether or not absence is recognised at all. `act` is recursive
          // (RFC 8693 §4.1), so `act.act` is a member whose value goes to the
          // structure walker, and that walker REFUSES a value which is not an
          // object. Only classifying `null` as absence FIRST keeps this token
          // readable.
          // ⚠ THE CAST REACHES PAST `ActClaimWire`, which types the nested `act`
          // as an actor rather than as `null` — aegis's own declarations already
          // forbid this shape, which is exactly why the row has to state the rule
          // for a wire nobody here declared. A stranger's token is not bound by
          // our types, and a `null` in a JSON document is the commonest thing in
          // one.
          act: { sub: "service-a", act: null as unknown as ActClaimWire },
        },
      },
    ],
    when: [{ step: "verify" }],
    then: [
      // ⭐⭐ `accepts` IS THE LOAD-BEARING ASSERTION, and it is a real one here:
      // with the absence classification removed, the structure walker meets
      // `null`, refuses it, and this verify throws. A row asserting only what the
      // result CONTAINS could not state that — a thrown verify reaches no content
      // assertion at all.
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      // The chain that WAS stated survives intact, so the omission is scoped to
      // the null member rather than swallowing the structure holding it.
      { step: "claims", expected: { act: { subject: "service-a" } } },
      { step: "bucket", bucket: "delegation", expected: { isDelegated: true } },
    ],
  },
  {
    id: "a-claim-member-that-is-not-of-its-declared-kind-is-neither-written-nor-reported",
    title:
      "a claim member that is not of its declared kind is neither written nor reported",
    rationale:
      "A signature binds an issuer to what a token SAYS, so the one disagreement a token must never contain is one between its writer and its reader. A structured claim's members each have a declared value shape, and the shape is checked on the way in — so if it is not also checked on the way out, the package can sign a token asserting a member and then report that same member as never stated when it reads its own output. That is worse than either behaviour alone: a caller who supplied the value sees it accepted, a recipient of the token sees it present, and a verifier reports it absent, with nothing anywhere raising a question. The check has to be the SAME check in both directions, and the emptiness verdict is a separate question from it — an empty string is a string, and whether an empty member rides is what the registry's emptiness column decides.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: {
          subject: "user-1",
          audience: [CLIENT],
          // ⚠⚠ THE CAST IS THE POINT, AND IT IS WHY THIS ROW NEEDS ONE. `null` is
          // an ABSENCE, with its own row above. What is left in this class cannot
          // be reached from a well-typed caller at all, so the row reaches past
          // the type to state the rule for the doors that have no type behind
          // them: a foreign token, an introspection response, a JavaScript caller.
          profile: { address: { region: 42 as unknown as string } },
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
      // The member is the address's only content, so dropping it leaves an empty
      // address, which the claim's own emptiness verdict then prunes — and the
      // claim's ABSENCE is a top-level fact both wires can state EXACTLY.
      //
      // ⚠ It therefore says nothing about whether the disposal is SCOPED to the
      // failing member — a walker that discarded the whole structure produces
      // this same absence. That is a separate rule and it has its own row below;
      // neither row can stand in for the other.
      { step: "wireClaims", excludes: ["address"] },
      // `absent`, not an empty bucket: an empty bucket is TRUTHY.
      { step: "bucket", bucket: "profile", absent: true },
    ],
  },
  {
    id: "refusing-one-claim-member-does-not-discard-the-members-beside-it",
    title: "refusing one claim member does not discard the members beside it",
    rationale:
      "The members of a structured claim are independently meaningful (OIDC Core §5.1.1) — a country is a fact about the end-user whether or not a postal code was available. A refusal must therefore be scoped to the value that failed: discarding the whole structure because one member was malformed destroys information the issuer had and the recipient could have used, and it does so silently, since a structure that arrives with fewer members is indistinguishable from one an issuer chose to send that way. It is also the failure a per-member check invites, because the cheapest way to reject a bad member is to abandon the walk.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: {
          subject: "user-1",
          audience: [CLIENT],
          // The refused member has a SURVIVING SIBLING, which is the only shape
          // in which this rule is observable at all.
          //
          // ⚠ The bad member must be a value that genuinely contradicts the
          // declared kind, which past `AegisProfileAddress` means a cast — see
          // the sibling row above for why that is the honest shape of this class
          // rather than a weakness in the row.
          profile: {
            address: { streetAddress: "Sample 1", region: 42 as unknown as string },
          },
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
      // The claim ARRIVES, carrying the member that passed. On COSE the value is
      // a CBOR map rather than a JSON object, so the nested reading is stated in
      // each wire's own vocabulary; the member-by-member byte assertions on both
      // wires live in `classes/address-claim-wire.test.ts`.
      {
        step: "wireClaims",
        on: "jose",
        includes: { address: { street_address: "Sample 1" } },
      },
      { step: "wireClaims", on: "cose", present: ["address"] },
      {
        step: "bucket",
        bucket: "profile",
        expected: { address: { streetAddress: "Sample 1" } },
      },
    ],
  },
  {
    id: "an-address-that-is-not-an-address-is-refused-not-read-as-an-absent-one",
    title: "an address that is not an address is refused, not read as an absent one",
    rationale:
      'The address claim is a structure of sub-fields (OIDC Core §5.1.1), so a scalar under that name is not an address that happens to be short — it is a claim that does not conform to its own definition, written by an issuer this verifier does not control. Two disposals are available and only one of them is honest. Reporting the scalar hands the consumer a value in a field whose declared shape is an object, and the consumer\'s first member access is then a runtime type error in code the type checker passed. Discarding it in silence is the subtler fault and the one that matters more: the result then says the token carries no address, which is a statement about the token that is FALSE — its issuer signed one — and the consumer cannot tell "no address was sent" from "an address was sent that I could not read", though the two call for opposite responses. A reader may decline to describe what it cannot describe; what it may not do is report a stranger\'s assertion as never made. So the claim is refused, and the token with it: the value rides inside the signature, so an issuer that cannot state this claim in the shape its own specification defines has not produced a token this verifier can speak for.',
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          exp: NOW + 3600,
          address: "Sample 1, 00100 Stockholm",
        },
      },
    ],
    when: [{ step: "verify" }],
    // ⚠ `claim` AND `invalid`, not the error class alone: every refusal in this
    // package is an `AegisError`, and this one shares its class AND its code with
    // the mandatory-member, key-collision and undeclared-member refusals. The
    // entry names WHICH position decided and WHAT was wanted there, so the row
    // cannot go green on a different fault reaching the same throw.
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: {
          claim: "address",
          invalid: [{ key: "address", message: 'Claim "address" must be an object' }],
        },
      },
    ],
  },
  {
    id: "a-wire-claim-whose-value-is-null-is-a-claim-the-token-does-not-state",
    title: "a claim carrying null on the wire is read as one the token does not state",
    rationale:
      "`null` is the only spelling of absence a JSON or CBOR payload can carry — neither encoding can express `undefined` — so it is the form an issuer's empty optional actually arrives in, and the one a reader meets on real tokens rather than in a caller's own dict. It is therefore not a value contradicting the claim's declared shape and must not be refused as one: an issuer writing `null` is an issuer stating nothing, and a reader that agrees with it reports what the issuer meant. The distinction is the whole boundary — a structured claim carrying a SCALAR is refused, because its issuer stated something the reader cannot describe, while the same claim carrying `null` was never stated at all. Collapsing the two in either direction is a fault: refuse both and ordinary nullable data becomes unreadable, drop both and a malformed claim disappears in silence.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: {
          iss: ISSUER,
          sub: "user-1",
          exp: NOW + 3600,
          // ⚠ THE SAME CLAIM AS THE ROW ABOVE, deliberately: the pair states a
          // boundary only if one fixture differs from the other in exactly the
          // value under judgement and in nothing else.
          address: null,
          // A SECOND claim, of a different codec kind, so the rule is stated
          // about the READ rather than about the one structured claim that
          // prompted it. `bool` is the arm that returns its input unchecked, so
          // it is the one that would report `null` in a field typed `boolean`.
          email_verified: null,
        },
      },
    ],
    when: [{ step: "verify" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      // `absent`, not an empty object: an empty bucket is TRUTHY, so a consumer
      // writing `if (result.profile)` would read one as populated and reach for
      // the address inside it. BOTH null claims bucket to `profile`, so the
      // bucket's absence states both at once.
      { step: "bucket", bucket: "profile", absent: true },
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
      "`act` names the party currently acting for the subject (RFC 8693 §4.1), and its whole purpose is that the recipient can tell a delegated presentation from a direct one. A result that dropped the chain would report the token as though the subject had presented it, so every authorisation decision downstream would attribute the request to the wrong party — and an actor policy stated against it would have nothing to read.",
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
      "`jti` is the identifier a replay check keys on, and the same claim is spelled `cti` on the COSE wire (RFC 7519 §4.1.7, RFC 8392 §3.1.7) — the one registered claim whose spelling differs between the two. A matcher keyed to one spelling and applied to the other finds nothing, so a caller that correlated a token with its own stored record would be told it did not match a token that does.",
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
    id: "an-empty-claim-the-registry-declares-a-statement-reaches-the-wire",
    title: "an empty claim whose emptiness is itself a statement is emitted",
    rationale:
      "An empty claim and an absent one are different statements, and for some claims the empty one is the one that restricts. An empty `scope` is a grant of nothing — the inert token. `scope` is only a SHOULD on an access token (RFC 9068 §2.2.3), so a recipient cannot tell an ABSENT scope from a grant that never carried one; the explicit empty list is therefore the only way an issuer can state that this grant conveys nothing, and deleting it would erase that statement rather than compress it. Which claims work this way is a property of the claim, and aegis policy records it per claim rather than leaving it to the caller.",
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
          scope: [],
        },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      // aegis keys `scope` at COSE integer label 9, so the two wires spell
      // the surviving claim differently — which is exactly why the row states
      // each rather than asserting one name on both.
      { step: "wireClaims", on: "jose", present: ["scope"] },
      { step: "wireClaims", on: "cose", present: [9] },
    ],
  },
  {
    id: "an-empty-scope-crosses-as-the-empty-string-and-reads-back-as-the-empty-grant",
    title:
      "an explicitly empty scope reaches the wire as the empty string and is read back as the empty list",
    rationale:
      "The wire form of `scope` is one space-separated string (RFC 8693 §4.2), so on the wire the empty grant is spelled as the empty string — and it must survive to the wire, because `scope` is only a SHOULD on an access token (RFC 9068 §2.2.3) and the explicit empty value is the one way an issuer can tell a grant of nothing apart from silence. Reading it back as the empty list keeps that one statement one statement in both vocabularies: a reader reporting the token as stating no scope at all would erase the restriction the issuer signed.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "access_token",
        content: {
          subject: "user-1",
          audience: [RESOURCE],
          clientId: CLIENT,
          scope: [],
        },
      },
    ],
    when: [{ step: "mint" }, { step: "verify" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      { step: "claims", expected: { scope: [] } },
      { step: "wireClaims", on: "jose", includes: { scope: "" } },
      { step: "wireClaims", on: "cose", includes: { 9: "" } },
    ],
  },
  {
    id: "an-empty-claim-the-registry-declares-inert-is-left-off-the-wire",
    title: "an empty claim that asserts nothing anyone can act on is not emitted",
    rationale:
      "The mirror case, and it fails open the other way. `amr: []` reads as 'the authentication methods are known and none applied' — a statement no issuer means and no audience can act on — so emitting it puts an assertion on the wire that nobody wrote. It reaches the boundary because a claim bag assembled from optional values ends up with empty containers in it, not because an issuer chose one. Which of the two an empty value is cannot be decided per call, only per CLAIM: the same knob that dropped this one would drop the empty `scope` above, and the token would say two different things depending on a setting made for unrelated reasons.",
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
          amr: [],
        },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      { step: "wireClaims", excludes: ["amr"] },
    ],
  },
  {
    id: "an-empty-claim-the-registry-declares-unsatisfiable-is-refused-at-the-raw-door",
    title:
      "an empty claim that states something no recipient can act on is refused at the door with no profile above it",
    rationale:
      "The third answer, and the one a profile cannot give. `cnf: {}` is the issuer's declaration that the presenter holds a particular key and that the recipient can confirm it (RFC 7800 §3), and it names no key — so emitting it mints a binding nothing satisfies and dropping it mints the bearer token the caller did not ask for. Neither disposal is what the issuer meant, so the value is refused while it is still in the producer's hands. The raw signing doors are where this has to hold: they run no profile, so the emission boundary is the only layer that can speak, and a refusal present on one wire alone would be a verdict the caller picks by encoding. The error is the same class and the same vocabulary a profile floor uses for the same empty value, because a caller choosing a profile must not thereby choose an error class.",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "opaque",
        claims: { cnf: {}, scope: [] },
      },
    ],
    when: [{ step: "mint" }],
    // `data.claim` is the DOMAIN name, never the wire key the door was handed:
    // that is what makes this refusal indistinguishable from the profile floor's.
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        code: "claim_empty_value",
        data: { claim: "confirmation", whenEmpty: "refuse" },
      },
    ],
  },
  {
    id: "a-claim-the-issuer-alone-defines-survives-the-empty-claim-prune",
    title: "a claim aegis has not declared reaches the wire with its empty value intact",
    rationale:
      "Whether an empty value is a statement or noise is a fact about the CLAIM: an empty `actions` in an authorization details element grants no action, because the permissions requested are the product of the values an element lists (RFC 9396 §2.2), while reading an ABSENT one as not restricted by action at all is aegis's own inference — and an empty `amr` asserts something no issuer means. A library holds that fact only for the claims it has defined. For anything else — a deployment's own claim, an opaque payload's members, a wire dict handed straight to a kit — it is guessing, and both guesses are wrong in a way the wire cannot show: dropping strips a restriction, keeping fabricates an assertion. So the prune stops at the edge of what aegis has declared, and a caller pruning its own claims stays the caller's job. That edge is what makes the prune safe to run on every emission: it can only ever act where a decision has actually been recorded.",
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
      { step: "wireClaims", present: ["empty_list"] },
    ],
  },
  {
    id: "an-event-payload-survives-the-empty-claim-prune",
    title:
      "a security event whose payload is the conventional empty object is kept on the wire",
    rationale:
      "The `events` claim's members are URIs identifying event statements, and a member value may be the empty object (RFC 8417 §2.2). OpenID Connect Back-Channel Logout 1.0 §2.4 makes that the normal case: the logout token carries the member `http://schemas.openid.net/event/backchannel-logout`, and the member's presence is the whole statement. A prune that removed empty containers indiscriminately would therefore delete the event itself, leaving a logout token that names no event and identifies nothing to act on. This is the claim on which the whole per-claim design is load-bearing: the one claim the profile REQUIRES is the one an indiscriminate prune would take.",
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
  {
    id: "an-event-type-reaches-the-wire-as-the-identifier-it-is",
    title: "a security event's type URI is carried onto the wire without conversion",
    rationale:
      "The `events` claim's members are named by URI (RFC 8417 §2.2). A URI is an identifier, not a field name, and a receiver dispatches on it character for character — so the house convention that flips a claim's key case on the way out (snake on write, camel on read) would not translate an event type but rename it, and the token would announce an event nobody is listening for. Every other structured claim in this registry either declares its member spellings or flips whatever it is handed; this one must do neither.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "logout_token",
        content: {
          subject: "user-1",
          audience: [CLIENT],
          events: { "https://schemas.lindorm.test/event/accountRecovery": {} },
        },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      {
        step: "wireClaims",
        on: "jose",
        includes: {
          events: { "https://schemas.lindorm.test/event/accountRecovery": {} },
        },
      },
      // ⚠ SPELLING, NOT SUBSTANCE. A COSE claims map keys `events` to a CBOR map,
      // which no object-shaped inclusion can compare against — the same split the
      // `address` rows take. The COSE value is pinned against the raw bytes in
      // `classes/events-claim-wire.test.ts`, which reads the map as a map.
      { step: "wireClaims", on: "cose", present: ["events"] },
    ],
  },

  // ---------------------------------------------------------------------------
  // The empty-header normalisation — what a producer's empty header parameter
  // becomes: nothing, or a refusal.
  // ---------------------------------------------------------------------------
  {
    id: "a-certificate-binding-that-names-no-certificate-is-refused",
    title: "a mint refuses a certificate thumbprint that identifies no certificate",
    rationale:
      "`x5t#S256` names the certificate corresponding to the key that signed the token (RFC 7515 §4.1.8), and it is the one header parameter a verifier acts on — PRESENCE IS THE BINDING. An empty thumbprint therefore has no safe disposal, which is what separates it from every other empty header parameter. Removing it hands the audience a token carrying no binding where the issuer intended one, so the audience accepts a token it would otherwise have had to attribute to a certificate. Emitting it mints a token whose binding no certificate can ever satisfy — one every conformant recipient rejects, including the ones the issuer wrote it for. Both outcomes are silent and neither is what the issuer asked for, so the only answer left is a refusal at the WRITE, where the producer still holds the value and can supply it or drop the parameter; a recipient can do neither.",
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
        // Cast locally: `x5t#S256` is kit-derived, so the caller's bag type Omits
        // it and no typed caller can reach this cell. The shape is reachable all
        // the same — an untyped caller here, and a foreign `IKryptos` reporting a
        // certificate it computes no thumbprint from on the key-derived tier.
        options: { header: { "x5t#S256": "" } as never },
      },
    ],
    // MINT is the act: the refusal IS the construction failing, and a token in
    // this shape must not exist for anything later to observe.
    when: [{ step: "mint" }],
    // ⚠ ONE VERDICT ON BOTH WIRES, which is the half this row exists to fix in
    // place. The refusal fires in the normalisation both builders share, upstream
    // of either wire's own disposal of the parameter — and those disposals
    // DISAGREE: JOSE reserves the parameter, COSE has no label for it at all.
    //
    // ⚠ `whenEmpty` IS WHAT MAKES THE JOSE CELL MEAN ANYTHING, and pinning only
    // `parameter` did not: `x5t#S256` is in every JOSE kit's reserved row, so the
    // reserved refusal is the same CLASS carrying the same `{ parameter }` — this
    // cell passed with the empty-value guard deleted. The two are different
    // refusals (who may SET the parameter, versus what its EMPTY value means) and
    // the registry cell that decided is the honest discriminator between them.
    then: [
      {
        step: "rejects",
        error: "AegisError",
        data: { parameter: "x5t#S256", whenEmpty: "refuse" },
      },
    ],
  },
  {
    id: "an-empty-critical-list-is-left-off-the-wire",
    title:
      "a token whose producer marked nothing critical carries no critical-parameter list",
    rationale:
      "Both wires forbid the empty list outright (RFC 7515 §4.1.11, RFC 9052 §3.1). A `crit` naming no parameter states that a recipient must understand nothing, which is what an ABSENT `crit` already states — so it adds no information and forfeits conformance to say it. It is also the shape a header bag assembled from optional values arrives in, so a writer that passed it through would emit a token its own reader refuses: aegis refuses an empty `crit` on arrival, and a library that mints what it will not verify has two answers to one question.",
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
        options: { header: { crit: [] } },
      },
    ],
    // VERIFY, not merely mint: the whole point is that the token aegis produced
    // is one aegis accepts. A `mint`-only act would leave the self-inconsistency
    // — minted here, refused by `validateCrit` — unobserved.
    when: [{ step: "verify" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      // Read off the RAW bytes by the independent inspector, per wire because the
      // two spell the parameter differently: COSE keys `crit` at integer label 2
      // (RFC 9052 §3.1), and CBOR keys an integer label and a text one apart
      // (RFC 9052 §1.5).
      { step: "wireProtectedHeader", on: "jose", excludes: ["crit"] },
      { step: "wireProtectedHeader", on: "cose", excludes: [2] },
    ],
  },
  {
    id: "a-parameter-marked-critical-with-nothing-to-understand-is-refused",
    title:
      "a mint refuses a header that marks a parameter critical while carrying no value for it",
    rationale:
      'A `crit` list is a producer\'s statement that a recipient is required to understand a named parameter (RFC 7515 §4.1.11 on JOSE, RFC 9052 §3.1 on COSE) — and on JOSE its VALUE as well (RFC 7515 §5.2). Naming a parameter while giving nothing to understand is that statement contradicting itself, and the contradiction is unrecoverable by the time anyone reads the token: a `crit` naming a label the protected bucket does not carry is a fatal error (RFC 9052 §3.1). Such a token is refused by EVERY recipient, including the ones the producer wrote it for, which is strictly worse than the merely-unsupported token the producer was asking for. The write is therefore the only place the contradiction can be both NAMED and REPAIRED — the caller still holds the parameter, and can either supply a value or stop marking it critical, where a recipient can do neither. ⚠ Treating a present-but-EMPTY value as that same fault is AEGIS POLICY: RFC 9052 §3.1 attaches the fatal error to an ABSENT label. A value that says nothing is one fault however it is spelled: `""`, `null`, `undefined` and a parameter simply not supplied all hand the recipient the same nothing, so they get the same refusal rather than three behaviours to remember.',
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
        // `oid` is the parameter that makes this row REPRODUCE the rule rather
        // than agree with it: it is caller-settable on both wires and the only
        // parameter aegis owns that a `crit` may name at all. ⚠ Refusing every
        // IANA-registered name is AEGIS POLICY, wider than the producer
        // prohibition it extends (RFC 7515 §4.1.11), which reaches only names
        // RFC 7515 and RFC 7518 define. So the row reaches the decision, instead
        // of asserting about a parameter a producer could never legitimately mark
        // critical in the first place.
        options: { header: { crit: ["oid"], oid: "" } },
      },
    ],
    // MINT is the act: the refusal IS the construction failing, and there is no
    // later observation to make — a token in this shape must not exist.
    when: [{ step: "mint" }],
    // ⚠ `data` is what makes the verdict SPECIFIC. `AegisError` is the base class
    // of every aegis error, so the row passed on ANY refusal — a reserved-parameter
    // throw, a label-resolution throw, an unrelated regression — and would have
    // stayed green with the crit check deleted. Naming the parameter the refusal is
    // about ties it to this rule. The value is `oid` on BOTH wires: the COSE half
    // reports the LABEL, and under the interoperable default `oid` rides its string
    // label rather than the lindorm private-use integer.
    then: [{ step: "rejects", error: "AegisError", data: { parameter: "oid" } }],
  },
  {
    id: "an-empty-content-type-is-not-a-content-type",
    title:
      "an object sealed under an empty content type is recovered as the object it was",
    rationale:
      "`cty` is the media type of the secured content (RFC 7515 §4.1.10), and the empty string is not a media type — it is a second spelling of the ABSENT parameter, which both the specification and aegis already define. Nothing has a rule for the second spelling, so it displaces the rule written for the first: a stated content type outranks the one a writer infers from the payload, and a reader given a type it does not recognise falls back to raw bytes. The consequence is silent and unrecoverable in the direction that matters — the token decrypts cleanly and hands back a different TYPE than was sealed, so a caller has no failure to catch and no way to tell the value was reinterpreted.",
    given: [
      { step: "keys", keys: ["ec-enc", "oct-enc"] },
      {
        step: "token",
        via: "domain-encrypt",
        data: { subject: "user-1", tenant: "acme" },
        options: { header: { contentType: "" } },
      },
    ],
    when: [{ step: "decrypt" }],
    then: [
      { step: "accepts", format: { jose: "jwe", cose: "cwe" } },
      // A Dict, key for key — not the Buffer a raw-bytes fallback yields. The
      // `raw` step compares the recovered VALUE, so a Buffer fails it by type.
      { step: "raw", expected: { subject: "user-1", tenant: "acme" } },
    ],
  },
  {
    id: "an-empty-cty-header-is-not-a-content-type",
    title:
      "an object sealed on the encryption kit under an empty cty is recovered as the object it was",
    rationale:
      "The same rule at the WIRE-named door, which is a public one: a caller reaches `aegis.jwe.encrypt` / `aegis.cwe.encrypt` directly and spells the parameter `cty` rather than `contentType`. Whether the empty string is a media type is a fact about the PARAMETER — `cty` is the media type of the secured content, and COSE carries the same parameter at label 3 (RFC 7515 §4.1.10, RFC 9052 §3.1) — so it cannot depend on which door the caller used or which encoding they picked. A door that resolved it differently hands back raw bytes where its sibling hands back the object, and the caller has no failure to catch: the token decrypts cleanly and only the TYPE has changed. The two encodings must also AGREE about it, or the parameter is present on one wire and absent on the other for one call, which is a difference an attacker chooses the encoding to exploit.",
    given: [
      { step: "keys", keys: ["ec-enc", "oct-enc"] },
      {
        step: "token",
        via: "kit-encrypt",
        kit: "sealed",
        data: { subject: "user-1", tenant: "acme" },
        options: { header: { cty: "" } },
      },
    ],
    when: [{ step: "decrypt" }],
    then: [
      { step: "accepts", format: { jose: "jwe", cose: "cwe" } },
      { step: "raw", expected: { subject: "user-1", tenant: "acme" } },
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
      "A profile written to accept tokens from an issuer we do not control is the one whose structural policy MUST run on the verify path — it can never run anywhere else, because nothing on this side ever mints such a token. ⚠ Requiring the issuer to be a URI is AEGIS POLICY, not a citation: `iss` is a StringOrURI (RFC 7519 §4.1.1), so the specification permits exactly what this refuses. The policy exists because the issuer identifier is what scopes key lookup — a bare identifier names no origin that can be resolved or compared, so accepting one lets the presenter name an issuer nobody can check. It sits deliberately looser than the issuer requirement in OIDC Core §2, because a third-party issuer need not be an OIDC provider.",
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
      "`exp` is the instant on or after which a token must not be accepted and `iat` is when it was issued (RFC 7519 §4.1.4, RFC 7519 §4.1.6), so a token whose expiry precedes its issuance describes a lifetime that never existed. No temporal range check catches it — each claim can be individually plausible — so the incoherence has to be caught as a relationship between them, or a token nobody could have legitimately produced passes every individual test.",
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
      "A profile injects the envelope claims a caller should not have to remember — who issued the token, when, and under what identifier. Each is a REGISTERED claim with a name of its own on each wire — `iss`, `iat` and `jti` on JOSE (RFC 7519 §4.1.1, RFC 7519 §4.1.6, RFC 7519 §4.1.7), labels 1, 6 and 7 on COSE (RFC 8392 §3.1.1, RFC 8392 §3.1.6, RFC 8392 §3.1.7) — so a value injected under a domain name and never translated arrives as an unregistered custom claim that looks right and answers nothing — no verifier's issuer check, replay cache or freshness bound reads it. Injection is also EXACTLY what the profile declares: a profile that does not name `notBefore` must not stamp one, or every token it issues carries a lower bound its issuer never chose.",
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
      "The shape a third-party authorization server actually emits is not the shape this package issues, and a profile that exists to READ one has to admit it. The multi-valued `aud` is the general case (RFC 7519 §4.1.3), and `client_id` is REQUIRED only of tokens issued under the JWT access-token profile (RFC 9068 §2.2), which a foreign server is under no obligation to follow. A resource server that could not read such a token would have no way to accept its own partners' tokens at all, and the usual workaround is to stop checking anything.",
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
      // `scope` arrives as the one string its registration defines (RFC 8693
      // §4.2) and is reported as the list that string spells.
      {
        step: "claims",
        expected: {
          subject: "user-1",
          audience: [RESOURCE, "account"],
          scope: ["openid", "profile"],
        },
      },
    ],
  },
  {
    id: "a-type-outside-the-claims-media-grammar-never-reaches-a-profile",
    title:
      "a token whose declared type is not a claims media type is refused before any profile is consulted",
    rationale:
      "The type header is what says which grammar a token's body follows, and the check that it names a claims media type is a WIRE guard: it is what stops a signed artifact of another kind being read as a claim set at all. The grammar admits the bare `JWT` (RFC 7519 §5.1) and the registered `+jwt` structured syntax suffix (RFC 8417 §7.2, RFC 6838 §4.2.8), and the COSE parameter has the same role (RFC 9596 §2). A bare word that is neither is outside the grammar, so no profile can be reached to admit it. ⚠ Enforcing that grammar at the WIRE door is AEGIS POLICY, not a citation: `typ` is OPTIONAL and processing it belongs to the application rather than to the token implementation, on either wire (RFC 7519 §5.1, RFC 9596 §2). The limit is worth stating plainly, because the tokens it excludes are real ones some deployments emit.",
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
      "The MULTI-valued `aud` is the general form and a single string the special case, on either wire (RFC 7519 §4.1.3, RFC 8392 §3.1.3). A resource server asserting its own identity is asking whether it is AMONG the audiences, never whether it is the only one, so a matcher compiled to an equality test answers 'no' for every token in the general form — and the deployments it breaks are exactly the ones whose issuer did the ordinary thing.",
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
      "The three hash claims come from TWO specifications and are defined the same way in both: `at_hash` over the access token (OIDC Core §3.1.3.6) and `c_hash` over the code (OIDC Core §3.3.2.11), while `s_hash` is not an OIDC Core claim at all and is defined over the `state` in identical terms by Financial-grade API Security Profile 1.0 Part 2 (Advanced) §5.1.1. All three take the hash algorithm from the id token's `alg` header parameter. A relying party holds the raw artifacts, never the digests, so the comparison has to happen where the SIGNING ALGORITHM is known — and `alg` is a header parameter. A verify that could not take the raw source would push the derivation onto every caller, and a caller that derives it from the wrong algorithm gets a mismatch it cannot explain.",
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
      "The `at_hash` binding is what lets a relying party detect an access token substituted for the one the id token was issued alongside (OIDC Core §3.1.3.6). It therefore has to FAIL for the substituted artifact — a derivation that computed a digest and then compared nothing would report success for every pair, which is the single condition the claim was added to make detectable.",
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
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: { invalid: ["accessToken"] },
      },
    ],
  },
  {
    id: "a-raw-source-written-as-a-condition-is-refused-rather-than-compared-to-the-digest",
    title:
      "a caller writing a condition operator under a raw hash source key is refused as unsupported",
    rationale:
      "The raw source keys name a value aegis HASHES with the hash function the token's `alg` header selects (OIDC Core §3.1.3.6) before comparing it to the digest claim, while a condition operator names a comparison over the claim as it is carried. The two readings cannot both hold for one key: hashing the operator's operand makes it meaningless, and applying the operator to the digest compares an unhashed value to a digest, which fails for the genuine source and reports it as a substituted artifact. A key that means a source to be hashed must therefore refuse any value it cannot hash, and name the key the caller wrote.",
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
      {
        step: "verify",
        // ⚠ LOCAL cast, deliberate: `DomainHashMatchers` types each source as a
        // string, which is the TYPE-level half of this same rule. The cast is what
        // lets the row state the RUNTIME half, for a caller reaching the API from
        // untyped code.
        assert: { accessToken: { $eq: AT_SOURCE } } as unknown as VerifyAssert,
      },
    ],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        code: "jwt_verify_unsupported_value",
        data: { key: "accessToken" },
      },
    ],
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
      "The domain surface exists so a caller states claims in ONE vocabulary and never has to know the wire's. It takes `tokenId` and returns `tokenId`, and it does so precisely because the wire spellings diverge — the claim is `jti` on JOSE and `cti` on COSE (RFC 7519 §4.1.7, RFC 8392 §3.1.7). A refusal that reports the WIRE name hands that divergence straight back: the caller receives a name it never wrote, and receives a DIFFERENT one depending on which encoding the issuer chose, so the only way to act on the failure is to carry a private reverse map of every claim on both wires. It also makes one field mean two things — the policy floor and the static claim matcher both report this list in domain names — so a consumer reading `invalid` cannot tell which vocabulary it was handed.",
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
  // The ROOT OPERATORS of a claim matcher — `$and` / `$or` / `$not`, at the root
  // and nested. The vocabulary is `@lindorm/match`'s: aegis compiles each branch
  // as it compiles the root, and the matcher decides what an operator means.
  // ---------------------------------------------------------------------------
  {
    id: "a-conjunction-of-claim-matchers-accepts-a-token-satisfying-every-member",
    title:
      "a caller stating a conjunction of claim matchers is answered by a token satisfying every member",
    rationale:
      "A matcher argument is a condition, and a condition composes: a caller whose requirement is stated as a conjunction of two claim matchers writes it as one, because the alternative is two calls that cannot share a verdict. A surface that read a composed condition as a claim name would find no such claim on any token and refuse every caller who composed one, so the accepting direction is what shows the composition was compiled rather than named.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "default",
        content: {
          subject: "user-1",
          expires: "1h",
          tokenType: "test_token",
          clientId: CLIENT,
        },
      },
    ],
    when: [
      { step: "mint" },
      {
        step: "verify",
        assert: { $and: [{ subject: "user-1" }, { clientId: CLIENT }] },
      },
    ],
    then: [{ step: "accepts" }],
  },
  {
    id: "a-conjunction-of-claim-matchers-is-refused-under-its-own-key-when-one-member-fails",
    title:
      "a caller stating a conjunction is refused by a token failing one member, and the refusal names the conjunction",
    rationale:
      "A conjunction holds only when every member does, so a token failing one member fails the whole. The refusal names the TOP-LEVEL entries of the matcher argument that did not hold, and a root operator is a top-level entry of its own: the caller wrote `$and`, and `$and` is what did not hold. Naming the member's claim instead would require the diagnosis to descend into a structure whose failing member is not always one claim — a nested disjunction fails as a whole — so the entry the caller wrote is the one reported.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "default",
        content: {
          subject: "user-1",
          expires: "1h",
          tokenType: "test_token",
          clientId: CLIENT,
        },
      },
    ],
    when: [
      { step: "mint" },
      {
        step: "verify",
        assert: { $and: [{ subject: "user-1" }, { clientId: "someone-else" }] },
      },
    ],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: { invalid: ["$and"] },
      },
    ],
  },
  {
    id: "a-disjunction-of-claim-matchers-accepts-a-token-satisfying-its-second-member",
    title:
      "a caller stating a disjunction is answered by a token satisfying only its second member",
    rationale:
      "A disjunction is how a caller states that either of two identities is acceptable — a token for the previous subject or the current one during a migration, a token from either of two deployments. It holds when any member does, and the member that holds must not have to be the first: a surface that evaluated only the first member would refuse every token the caller admitted through the second while accepting through the first, which reads as a working disjunction on every test that names the accepted identity first.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "default",
        content: { subject: "user-1", expires: "1h", tokenType: "test_token" },
      },
    ],
    when: [
      { step: "mint" },
      {
        step: "verify",
        assert: { $or: [{ subject: "someone-else" }, { subject: "user-1" }] },
      },
    ],
    then: [{ step: "accepts" }],
  },
  {
    id: "a-negated-claim-matcher-is-refused-under-its-own-key-by-a-token-matching-it",
    title:
      "a caller negating a claim matcher is refused by a token matching the negated matcher, and the refusal names the negation",
    rationale:
      "A negation is how a caller excludes an identity — a token for a revoked client, a subject that must not reach this resource. It fails exactly when its payload holds, and the refusal names the top-level entry that failed, which is `$not`: the claim inside the negation did not fail, it matched, and naming it as failing would tell the caller the opposite of what happened. The diagnosis that names the failing entries evaluates each against the whole claim set, because a negation has no claim of its own to read.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "default",
        content: { subject: "user-1", expires: "1h", tokenType: "test_token" },
      },
    ],
    when: [{ step: "mint" }, { step: "verify", assert: { $not: { subject: "user-1" } } }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: { invalid: ["$not"] },
      },
    ],
  },
  {
    id: "a-raw-hash-source-inside-a-disjunction-is-derived-and-compared-to-the-digest",
    title:
      "a caller stating a raw access token inside a disjunction is answered by the id token issued alongside it",
    rationale:
      "The `at_hash` binding (OIDC Core §3.1.3.6) is stated with the RAW access token, and aegis derives the digest with the hash function the token's `alg` selects. A branch of a condition is compiled exactly as the root is, so a raw source inside one is derived there too — a compile that derived only at the root would compare the raw source literally to the digest inside a branch, which matches no genuine pair and reads as a substituted access token. The satisfying member is placed second so that the accept can only come from a branch that was derived.",
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
      {
        step: "verify",
        // ⚠ LOCAL cast, deliberate: the nested members of a `Condition` are typed
        // over the domain CLAIMS, and a raw hash source is a matcher, not a claim.
        // The cast is what lets the row state the runtime rule for a caller
        // reaching the API from untyped code.
        assert: {
          $or: [{ accessToken: "a-different-access-token" }, { accessToken: AT_SOURCE }],
        } as unknown as VerifyAssert,
      },
    ],
    then: [{ step: "accepts" }],
  },
  {
    id: "a-raw-source-and-its-digest-claim-in-separate-branches-are-not-a-conflict",
    title:
      "a caller stating the raw source in one branch and the digest claim in another is answered on content",
    rationale:
      "A raw source and its digest claim resolve to ONE wire claim, and stating both in one matcher object is refused because only one of them could be checked. Two branches of a disjunction are two matcher objects, each compiled on its own: the raw source is checked in one and the digest in the other, and nothing is displaced. A refusal that reached across branches would forbid the one construction — accept the digest I hold OR the source I was handed — that a disjunction over a binding exists to state.",
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
      {
        step: "verify",
        // ⚠ LOCAL cast, deliberate: the nested members of a `Condition` are typed
        // over the domain CLAIMS, and a raw hash source is a matcher, not a claim.
        assert: {
          $or: [{ accessToken: AT_SOURCE }, { accessTokenHash: "a-digest" }],
        } as unknown as VerifyAssert,
      },
    ],
    then: [{ step: "accepts" }],
  },
  {
    id: "a-matcher-left-undefined-is-never-the-one-a-refusal-names",
    title:
      "a caller leaving the raw source undefined beside a wrong digest claim is refused under the digest claim",
    rationale:
      'An `undefined` matcher is not stated (`@lindorm/match`: it means "not specified"), so it takes part in nothing — neither the predicate nor the vocabulary a refusal is reported in. The raw source and its digest claim share one wire claim, so a report that read the unstated key would name it for a failure the stated key produced, and the caller would be told a matcher they never wrote is wrong.',
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
      {
        step: "verify",
        assert: { accessTokenHash: "a-wrong-digest", accessToken: undefined },
      },
    ],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: { invalid: ["accessTokenHash"] },
      },
    ],
  },
  {
    id: "a-raw-source-beside-its-digest-claim-inside-one-branch-is-refused-as-conflicting",
    title:
      "a caller stating the raw source beside the digest claim inside one branch is refused as conflicting matchers",
    rationale:
      "The refusal of a raw source stated beside its digest claim is about the matcher OBJECT the two share, and a branch is a matcher object: inside it the two resolve to one wire claim and the second would displace the first exactly as at the root. A rule that held at the root and lapsed one level down would let the verdict turn on key order for any caller who composed their matcher.",
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
      {
        step: "verify",
        // ⚠ LOCAL cast, deliberate: the nested members of a `Condition` are typed
        // over the domain CLAIMS, and a raw hash source is a matcher, not a claim.
        assert: {
          $or: [{ accessToken: AT_SOURCE, accessTokenHash: "a-digest" }],
        } as unknown as VerifyAssert,
      },
    ],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        code: "jwt_verify_conflicting_matchers",
      },
    ],
  },
  {
    id: "the-temporal-window-applies-at-the-root-whatever-the-matcher-nests",
    title:
      "an expired token is refused even when the caller's matcher is a disjunction the token satisfies",
    rationale:
      "The temporal window is a bound the verifier applies, never a matcher the caller composes: `exp` is the instant on or after which the token must not be accepted for processing (RFC 7519 §4.1.4), and that obligation does not enter into any disjunction the caller writes. It is applied beside the caller's matcher at the root, so a composed matcher the token satisfies changes nothing about an expiry it has passed — a window that joined the caller's disjunction as one more member would be satisfied by whichever member the caller made true.",
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
    when: [{ step: "verify", assert: { $or: [{ subject: "user-1" }] } }],
    then: [{ step: "rejects", error: "AegisError" }],
  },
  {
    id: "a-malformed-disjunction-throws-as-the-matchers-own-error",
    title:
      "a caller stating a disjunction with no member is answered with the matcher's own error",
    rationale:
      "A disjunction with no member is not a condition a token can satisfy or fail: the matcher vocabulary refuses the shape outright rather than deciding it (`@lindorm/match`: omit the key to place no constraint), so it is the caller's coding error and says nothing about the token. Aegis reports it as itself — the matcher's `TypeError`, on `verify` and on the static door alike — because a coding error dressed as a claims verdict sends an operator to the token when the fault is in the call. Only a failed evaluation is `claims_invalid`.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "default",
        content: { subject: "user-1", expires: "1h", tokenType: "test_token" },
      },
    ],
    when: [{ step: "mint" }, { step: "verify", assert: { $or: [] } }],
    then: [{ step: "rejects", error: "TypeError" }],
  },
  {
    id: "a-malformed-negation-throws-as-the-matchers-own-error",
    title:
      "a caller negating a value that is not a condition is answered with the matcher's own error",
    rationale:
      "A negation takes a condition, so a `$not` whose payload is not an object states nothing a token can be tested against; `@lindorm/match` refuses the shape rather than answering it, which makes it the caller's coding error and never a verdict about the token. Aegis reports it as itself — the matcher's `TypeError`, on `verify` and on the static door alike. Only a failed evaluation is `claims_invalid`.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "default",
        content: { subject: "user-1", expires: "1h", tokenType: "test_token" },
      },
    ],
    when: [
      { step: "mint" },
      {
        step: "verify",
        // ⚠ LOCAL cast, deliberate: the shape is the one the type forbids, and
        // the row states what the door answers when a caller writes it anyway.
        assert: { $not: "x" } as unknown as VerifyAssert,
      },
    ],
    then: [{ step: "rejects", error: "TypeError" }],
  },
  {
    id: "an-empty-negation-is-refused-under-its-own-key",
    title: "a caller negating an empty condition is refused by every token",
    rationale:
      "An empty condition constrains nothing and every claim set satisfies it (`@lindorm/match`), so its negation is satisfied by none. Aegis compiles the shape through and lets the matcher decide it: the negation fails, and the refusal names the entry the caller wrote.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "default",
        content: { subject: "user-1", expires: "1h", tokenType: "test_token" },
      },
    ],
    when: [{ step: "mint" }, { step: "verify", assert: { $not: {} } }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: { invalid: ["$not"] },
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
      "A signature covers an arbitrary sequence of octets (RFC 7515 §1), so the opaque door is the one a caller uses for a payload that is not a claim set — a stored blob, an encoded record — and it is a SEPARATE forward from the claims door with its own key resolution and its own verify call. A door that could sign but not verify would leave every such artifact unreadable by the package that wrote it, and there would be no other surface to reach it from: the claims reader refuses an opaque artifact by design rather than returning an empty claim set.",
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
      "`typ` is OPTIONAL, and processing it belongs to the application rather than to the token implementation, on either wire (RFC 7519 §5.1, RFC 9596 §2) — so a typ-less claims token is conformant. Whether to accept one is an APPLICATION policy, which is where the domain surface enforces it; the raw wire door is not the application, so a presence rule imposed there would refuse conformant tokens with no way for the caller to say otherwise.",
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
      // ordinary typed token and says nothing about typ-lessness at all. The
      // COSE `typ` is label 16 (RFC 9596 §4.1).
      { step: "wireProtectedHeader", on: "jose", excludes: ["typ"] },
      { step: "wireProtectedHeader", on: "cose", excludes: [16] },
    ],
  },
  {
    id: "the-raw-claims-verify-honours-a-waived-expiry-range-check",
    title:
      "the raw claims verify accepts an expired token when the caller waives the expiry range",
    rationale:
      "`exp` is a bound a verifier enforces (RFC 7519 §4.1.4), and waiving it is a narrow, legitimate request — inspecting a previously-issued token where the signature, not the lifetime, is what is being trusted. The raw door threads its own option bag by hand, so it can honour an option the domain door honours and drop the one beside it; the caller sees no difference, because a dropped waiver simply rejects and a dropped tightening simply accepts.",
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
      "A small leeway for clock skew is allowed when checking `exp` (RFC 7519 §4.1.4). The leeway is a NUMBER rather than a flag, so it is the option that shows the whole bag reaches the raw door and not merely the booleans a hand-written forward is most likely to remember: a token ten seconds past its expiry must verify under a sixty-second allowance and fail without one.",
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
      "A library must let the caller restrict which algorithms it will use, and must honour that restriction (RFC 8725 §3.1). The raw door is where a caller reaches the wire directly, so a policy dropped there is worse than no policy at all: the caller believes the constraint is in force and stops checking, and the token's own header is left to decide which vault resident verifies it.",
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
  // The `act` claim and its nesting are RFC 8693 §4.1. Everything below is a
  // policy over that structure.
  // ---------------------------------------------------------------------------
  {
    id: "a-token-that-names-no-actor-reports-an-empty-delegation-chain",
    title: "a token presented by its own subject reports a delegation bucket saying so",
    rationale:
      "The `act` claim is what expresses that delegation has occurred (RFC 8693 §4.1). Its ABSENCE is therefore a positive statement about the presentation, and the result has to carry that statement rather than leave the bucket off: a consumer reading `isDelegated` off an absent bucket reads `undefined`, which is falsy, so the direct case and the case where the read side simply lost the chain become indistinguishable — and the second is the one that misattributes a delegated request to the subject.",
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
      "An `act` claim says the request is being made by a party acting FOR the subject rather than by the subject (RFC 8693 §4.1). An operation that must be performed by the end-user in person — a credential change, a consent — is authorised by the subject and not by anyone acting for them, so the verifier needs a way to refuse the delegated form outright. Without it the only remaining defence is that every downstream check happens to notice the actor, which none of them are written to do.",
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
    id: "an-actor-allowlist-ignores-the-prior-actors-in-the-chain",
    title:
      "a verifier listing the actors it trusts accepts a chain whose earlier actors it does not list",
    rationale:
      "The allowlist answers one question — is the party making THIS call one the verifier trusts — and it is read against that party alone (RFC 8693 §4.1). The hops a credential took before it arrived are history about parties that are no longer touching the request; holding the list against all of them would refuse a token over a party that cannot act on it any more, and a list that refuses on history is one a deployment can keep only by naming every intermediary that has ever existed or by dropping the list.",
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
        options: { actor: { allowedActor: { subject: "service-1" } } },
      },
    ],
    then: [{ step: "accepts", format: { jose: "jwt", cose: "cwt" } }],
  },
  {
    id: "an-actor-allowlist-refuses-a-chain-whose-current-actor-it-does-not-name",
    title:
      "a verifier listing the actors it trusts refuses a chain whose calling actor is not listed",
    rationale:
      "The refusal is the whole of the constraint: an unlisted party wielding the token is exactly what a deployment states this option to stop, and it is the half that is invisible when it is missing, because a check that always accepts and a check that is correct agree on every token that was going to be accepted anyway. ⚠ The unlisted party here is the CURRENT actor and the listed one is a prior actor, so a policy that searched the chain rather than reading its head would accept this token (RFC 8693 §4.1).",
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
          act: { sub: "rogue", act: { sub: "service-1" } },
        },
      },
    ],
    when: [
      {
        step: "verify",
        options: { actor: { allowedActor: { subject: "service-1" } } },
      },
    ],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "an-actor-allowlist-refuses-a-token-that-names-no-actor",
    title:
      "a verifier listing the actors it trusts refuses a token presented by its own subject",
    rationale:
      "A constraint on who may act cannot be satisfied by nobody acting. The `act` claim is what expresses that delegation has occurred and identifies the acting party (RFC 8693 §4.1), so a token carrying none names no such party at all — a different presentation from the ones the list was written to admit. Admitting it would make the allowlist a constraint that applies only once some other claim happens to be present, and a verifier stating one would have to state a delegation requirement beside it to get back the refusal it had already asked for.",
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
        options: { actor: { allowedActor: { subject: "service-1" } } },
      },
    ],
    then: [{ step: "rejects", error: "AegisDomainError" }],
  },
  {
    id: "an-actor-allowlist-stated-as-a-denial-refuses-a-token-that-names-no-actor",
    title:
      "a verifier whose actor allowlist names the parties it refuses still refuses a token presented by its own subject",
    rationale:
      "Naming the parties a verifier will not accept states the same policy as naming the ones it will: some party is acting, and it is not one of those. The refusal of a token naming no actor therefore has to be decided before the condition is applied rather than by it — the condition language negates two-valuedly (`@lindorm/match`, `$not`), so an actor that is not there fails to match anything and consequently satisfies every denial. A verifier whose policy survived being rewritten from a list of admitted parties into a list of refused ones, but whose refusal of the undelegated presentation did not, has had a hole opened by an edit that changed nothing it could observe.",
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
        options: { actor: { allowedActor: { $not: { subject: "rogue" } } } },
      },
    ],
    // The `code` separates the two refusals a bad `allowedActor` can draw: this
    // row is about the TOKEN failing a well-formed condition, and it would read
    // as green if the condition were instead refused as one that constrains
    // nothing.
    then: [{ step: "rejects", error: "AegisDomainError", code: "actor_not_allowed" }],
  },
  {
    id: "an-actor-allowlist-that-constrains-nothing-is-refused",
    title:
      "a verifier stating an actor allowlist with no condition in it has the call refused rather than obeyed",
    rationale:
      "A condition naming no field is satisfied by every actor, so an allowlist written that way authorises everyone while the call site still reads as an allowlist — and the deployment that wrote it has stopped checking elsewhere precisely because it believes this check is in force. Nothing downstream can notice, since every token the policy should have refused is accepted instead. Refusing the CALL is what makes it visible: a policy that cannot refuse is worse than no policy at all. ⚠ It is the CONDITION that must state something, not the option: an absent `allowedActor` states no actor policy and stays legal.",
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
          // An actor the empty condition WOULD match. Without one the token is
          // refused for naming no actor at all, and the row could not tell a
          // working guard from a missing one.
          act: { sub: "service-1" },
        },
      },
    ],
    when: [{ step: "verify", options: { actor: { allowedActor: {} } } }],
    // The `code` is part of the capability: the refusal names the CALLER's option
    // as the malformed thing. Sharing `actor_not_allowed` with the token-shaped
    // refusals would send an operator to read a token that is fine.
    then: [{ step: "rejects", error: "AegisDomainError", code: "actor_policy_invalid" }],
  },
  {
    id: "an-actor-allowlist-with-an-alternative-that-constrains-nothing-is-refused",
    title:
      "a verifier stating an actor allowlist whose alternatives include one with no condition in it has the call refused rather than obeyed",
    rationale:
      "A list of alternatives admits an actor satisfying any ONE of them, so an alternative naming no field admits every actor and the surrounding list stops constraining — while the call site still reads as a list of trusted parties, and every alternative that does name a party still reads as if it were being held against the actor. This is the shape a list assembled from configuration produces: one entry that names nothing yields one alternative that constrains nothing, and the list nobody wrote out by hand is the one nobody re-reads. Refusing the CALL is what makes it visible: a policy that cannot refuse is worse than no policy at all.",
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
          // An actor NO named alternative admits, so only the degenerate one can
          // let it through — which is what separates a working guard from a
          // missing one here.
          act: { sub: "service-1" },
        },
      },
    ],
    when: [
      {
        step: "verify",
        options: {
          actor: { allowedActor: { $or: [{ subject: "nobody" }, {}] } },
        },
      },
    ],
    then: [{ step: "rejects", error: "AegisDomainError", code: "actor_policy_invalid" }],
  },
  {
    id: "an-actor-chain-deeper-than-the-stated-bound-is-refused",
    title:
      "a verifier bounding the delegation depth refuses a chain longer than it allows",
    rationale:
      "A chain nests one `act` claim within another (RFC 8693 §4.1), and every additional hop is another party that has held the token. A depth bound is how a deployment states how far a credential may travel from the party that authorised it, and it is also the only structural bound on the claim at all — an unbounded nesting is an unbounded parse, so a verifier that never reads the depth cannot refuse a chain built purely to be expensive.",
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
  {
    id: "an-actor-carries-an-identity-claim-the-registry-does-not-declare",
    title:
      "a mint carries an actor member RFC 8693 permits and aegis does not declare, at every depth",
    rationale:
      "The actor's member set is OPEN TO FURTHER IDENTITY CLAIMS, and so is `may_act`'s — both sections close it to non-identity ones (RFC 8693 §4.1, RFC 8693 §4.4). ⚠ aegis DECLARES one of the excluded members anyway, `audience`, so a consumer can validate what an issuer wrote: a public-surface departure with its own decision to make, not a reading of RFC 8693 §4.1 (`src/internal/claims/act-members.ts#IS DECLARED THOUGH RFC 8693 §4.1 EXCLUDES IT`). So the set of claims that may identify an actor belongs to the deployment and to the other specifications it composes with, not to this library: an issuer that needs one more identifier must be able to write it, and a reader must report it rather than pretend the issuer said less. The member travels UNTOUCHED because its name was given by whoever registered it — a case flip would not translate it but rewrite it into a field nobody reads. ⚠ The nesting is part of the rule and not a bonus: a nested `act` is the same kind of object as the outer one (RFC 8693 §4.1), so a member set that opened at the top and closed one level down would be a rule about nothing.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "access_token",
        content: {
          subject: "user-1",
          audience: [RESOURCE],
          clientId: CLIENT,
          // Cast locally: the DECLARED five are a closed TypeScript shape
          // (`ActClaimMembers`), and the open tail reaches the public type through
          // an index signature — so the literal below is legal at runtime and the
          // cast only satisfies excess-property checking on a nested literal.
          act: {
            subject: "service-1",
            act: { subject: "service-2", email: "service-2@example.test" },
          } as never,
        },
      },
    ],
    when: [
      { step: "mint" },
      { step: "verify", profile: "access_token", options: { audience: RESOURCE } },
    ],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      // The RAW wire: the declared member takes its RFC 8693 spelling and the
      // undeclared one keeps its own, at DEPTH — which is where a tail policy
      // applied only to the top level would show.
      {
        step: "wireClaims",
        on: "jose",
        includes: {
          act: {
            sub: "service-1",
            act: { sub: "service-2", email: "service-2@example.test" },
          },
        },
      },
      // …and back under the domain vocabulary, so the member survives the round
      // trip rather than merely reaching the wire.
      {
        step: "claims",
        expected: {
          act: {
            subject: "service-1",
            act: { subject: "service-2", email: "service-2@example.test" },
          },
        },
      },
    ],
  },
  {
    id: "a-foreign-actor-member-is-reported-rather-than-quietly-dropped",
    title:
      "a verify reports an actor member of somebody else's token that aegis does not declare",
    rationale:
      "A read reports what a PRODUCER wrote. Dropping a member the library has no declaration for makes it misreport a stranger's token as saying LESS than it says, and does so silently — so nothing downstream can tell an actor the issuer described in two members from one they described in three, and a deployment that depends on the extra identifier discovers the loss only where it eventually matters. That is worse than either honest alternative: refusing says the token cannot be read, reporting says what it contains. The extra member is legitimate in the first place (RFC 8693 §4.1), so refusing would reject conformant issuers, which leaves reporting as the only answer that is both honest and usable.",
    given: [
      {
        // A FOREIGN token, written through the raw kit door — which performs no
        // translation, so the wire says exactly what this row means it to say.
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
          act: { sub: "service-1", email: "service-1@example.test" } as never,
        },
      },
    ],
    when: [{ step: "verify" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      {
        step: "claims",
        expected: {
          act: { subject: "service-1", email: "service-1@example.test" },
        },
      },
    ],
  },
  {
    id: "an-actor-is-identified-by-the-member-rfc-8693-defines-and-by-no-look-alike",
    title:
      "a token whose actor carries a domain-spelled look-alike beside the real one is refused, not re-read from the look-alike",
    rationale:
      'The acting party is identified by the claims inside the `act` object, `sub` among them (RFC 8693 §4.1). WHICH party the issuer named is therefore decided by that member and by nothing else. The actor\'s member set is OPEN — a deployment may add a further identity member (RFC 8693 §4.1) — and an open set is what makes this reachable: a member the library carries untouched can be spelled exactly like the library\'s own DOMAIN name for a member it does declare, so `sub` and `subject` both arrive at `subject` and something has to decide between them. Deciding by key order hands the identification to whoever presents the token: a chain the issuer wrote as `{"sub":"audited-service"}` is re-read as naming a different actor entirely by appending one member the issuer never wrote, and every allowlist, every scope and every audit record downstream then names the wrong party. There is no safe winner to pick — the token is self-contradictory about the one fact the claim exists to state — so the collision is refused, naming the key both members resolved to. It is the same hazard the top-level floor treats as load-bearing when it refuses to let a custom `audience` answer for the registered `aud`, one level in. ⭐ And the refusal cannot depend on the issuer having written the real member too: an actor naming ONLY the look-alike produces a domain claim BYTE-IDENTICAL to one built from a genuine `sub`, so a consumer reading `act.subject` for an allowlist or an audit record has nothing to tell the two apart. Carrying an unknown member and carrying it into a declared member\'s own slot are two different acts, and only the first is what the open member set is for (RFC 8693 §4.1).',
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
          // BOTH spellings: `sub` is what the issuer wrote, `subject` is the
          // look-alike. ⚠ This row states the PAIR; its sibling below
          // (`an-actor-look-alike-is-refused-even-when-the-real-member-is-absent`)
          // states the harder half, where the look-alike arrives ALONE. Two rows
          // rather than one because the second is what a presence-dependent
          // refusal passes: being ignored and being written into `subject` are
          // not the same outcome.
          act: { sub: "audited-service", subject: "rogue-service" },
        },
      },
    ],
    when: [{ step: "verify" }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: {
          claim: "act",
          invalid: [
            {
              key: "act.subject",
              message: 'Members "sub" and "subject" both resolve to "subject" in "act"',
            },
          ],
        },
      },
    ],
  },
  {
    id: "an-actor-look-alike-is-refused-even-when-the-real-member-is-absent",
    title:
      "a token whose actor names ONLY a domain-spelled look-alike is refused, not read as identifying that actor",
    rationale:
      "The dangerous form of a look-alike is the one that arrives ALONE. The acting party is identified by the claims inside the `act` object, `sub` among them (RFC 8693 §4.1); a token writing `subject` instead produces a domain claim BYTE-IDENTICAL to one built from a genuine `sub`, so every consumer downstream — an allowlist, a scope decision, an audit record — reads a party the issuer never named and has nothing to tell the two apart. With BOTH members present there is a visible contradiction for a reader to refuse; with only the look-alike there is none, which makes this the case a refusal must cover rather than the one it may skip. Carrying an unknown member and writing one into a declared member's own slot are two different acts, and only the first is what the open member set is for (RFC 8693 §4.1); only the second is indistinguishable from the truth.",
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
          // ⚠ NO `sub`. That is the whole difference from the sibling row above,
          // and it is what a refusal built from the members that ARRIVED lets
          // through: with nothing to collide against, the look-alike takes the
          // declared member's slot uncontested.
          act: { subject: "rogue-service" },
        },
      },
    ],
    when: [{ step: "verify" }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: {
          claim: "act",
          invalid: [
            {
              key: "act.subject",
              message: 'Members "sub" and "subject" both resolve to "subject" in "act"',
            },
          ],
        },
      },
    ],
  },
  {
    id: "an-address-member-spelled-in-the-domain-vocabulary-is-refused-on-the-wire",
    title:
      "a token whose address names a member in the library's own domain spelling is refused, not read as that member",
    rationale:
      "An address member is spelled `street_address` on the wire (OIDC Core §5.1.1) and `streetAddress` in the library's domain vocabulary. A token writing the domain form is writing a name no specification defines into the slot the specification's own member resolves to, and the result a consumer reads is indistinguishable from a conformant token — so the deployment cannot tell whether the issuer followed the specification. The address claim carries a case-flipped open tail precisely because an undeclared member is a lindorm extension of a lindorm type; a member that is NOT undeclared, merely spelled in the wrong vocabulary, is not that. Stated on `address` as well as on the actor chain because they take DIFFERENT tail policies — a flipped tail and a verbatim one — and a rule that held for only one of them would be a rule about the tail policy rather than about the member set.",
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
          address: { streetAddress: "Storgatan 1" },
        } as never,
      },
    ],
    when: [{ step: "verify" }],
    then: [{ step: "rejects", error: "AegisDomainError", data: { claim: "address" } }],
  },
  {
    id: "a-caller-cannot-write-two-spellings-of-one-structured-member",
    title:
      "a mint refuses a structured claim whose caller wrote both spellings of one member",
    rationale:
      "The read-side hazard has a write-side twin, and it is the same defect from the other end: a caller who writes both the domain and the wire spelling of one member has told the library two things about one field, and an emission that picks a winner signs whichever the object's key order happened to put last. What reaches the wire then depends on how the caller's object was assembled rather than on what they meant, and the caller has no way to see which one was chosen — the token verifies, and the field is simply wrong. Refusing at the emission boundary is the last moment the value is still in the producer's hands.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "access_token",
        content: {
          subject: "user-1",
          audience: [RESOURCE],
          clientId: CLIENT,
          // `subject` is the DECLARED member and resolves to the wire `sub`; a
          // caller-supplied `sub` rides the open tail verbatim and lands on the
          // same key. Neither is nonsense on its own, which is what makes the
          // pair a genuine ambiguity rather than a typo.
          act: { subject: "declared-actor", sub: "shadow-actor" },
        },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: {
          claim: "act",
          invalid: [
            {
              key: "act.sub",
              message: 'Members "sub" and "subject" both resolve to "sub" in "act"',
            },
          ],
        },
      },
    ],
  },
  {
    id: "every-fault-in-one-structure-is-reported-not-just-the-first",
    title:
      "a mint refuses a structured claim naming EVERY fault it carries, not the one the walker reached first",
    rationale:
      "A structure refusal is a repair instruction, and every fault it withholds costs the caller another round trip to discover. Two members colliding on one key and two other members colliding on a different key are INDEPENDENT faults: neither creates the other, and repairing one leaves the other exactly as it was — so a walk that returned at the first would report an N-fault structure as a one-fault structure and the caller would rediscover the rest one mint at a time, each time with no token issued and no way to see how far the problem went. Reporting all of them is also the only form in which the entry list describes the VALUE rather than the walk: a single entry says which member the walker happened to reach first, and that is a fact about the caller's key insertion order, not about the claim.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "access_token",
        content: {
          subject: "user-1",
          audience: [RESOURCE],
          clientId: CLIENT,
          // ⚠⚠ TWO INDEPENDENT COLLISIONS, ON TWO DIFFERENT KEYS. `issuer`/`iss`
          // meet on `iss` and `subject`/`sub` meet on `sub` — separate declared
          // members, separate tail members, separate outgoing keys. Neither pair
          // is why the other was found: drop the `subject`/`sub` pair and the
          // `iss` entry is still the whole refusal, and the reverse holds too.
          // That is what makes the two-entry pin a statement about AGGREGATION
          // rather than the causal chain the confirmation row above states.
          act: {
            issuer: "https://declared-issuer.test",
            iss: "https://shadow-issuer.test",
            subject: "declared-actor",
            sub: "shadow-actor",
          },
        },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: {
          claim: "act",
          invalid: [
            {
              key: "act.iss",
              message: 'Members "iss" and "issuer" both resolve to "iss" in "act"',
            },
            {
              key: "act.sub",
              message: 'Members "sub" and "subject" both resolve to "sub" in "act"',
            },
          ],
        },
      },
    ],
  },
  {
    id: "a-refusal-locates-a-fault-nested-two-structures-deep",
    title:
      "a mint refusing a fault inside a nested actor names the path to it, not the claim it sits in",
    rationale:
      "The actor claim nests itself (RFC 8693 §4.1), so a delegation chain puts the same member set at every depth and a bare claim name cannot say WHICH actor in the chain is malformed. A caller told only that `act` is wrong has to search a structure whose shape gave them no place to look, and the deeper the chain the less the refusal says — which is the point at which a claim that exists to record who acted for whom stops being repairable. The entry key therefore carries the full path from the claim down to the offending member, and the message names the structure the two members met in rather than the claim they are nested under.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "access_token",
        content: {
          subject: "user-1",
          audience: [RESOURCE],
          clientId: CLIENT,
          // The OUTER actor is well formed; the fault sits one hop back in the
          // chain, so nothing above depth 2 can locate it. `subject` is the
          // declared member and the tail `sub` is the wire spelling of that same
          // member, exactly as in the depth-1 row above — the SHAPE is held
          // constant so the only thing this row varies is the depth.
          act: {
            subject: "outer-actor",
            act: { subject: "declared-actor", sub: "shadow-actor" },
          },
        },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: {
          claim: "act",
          invalid: [
            {
              key: "act.act.sub",
              message: 'Members "sub" and "subject" both resolve to "sub" in "act.act"',
            },
          ],
        },
      },
    ],
  },
  {
    id: "a-refusal-locates-a-fault-inside-one-element-of-a-collection",
    title:
      "a mint refusing a fault below a collection element names the index AND the member, not the collection",
    rationale:
      "A Subject Identifier of format `aliases` carries a LIST of identifiers (RFC 9493 §3.2.8), so a refusal that stopped at the claim would tell a caller only that one of an unbounded list is wrong, and one that stopped at the element index would not say which part of that element to look at. Both leave the caller searching. The entry key therefore keeps growing past the index: it names the collection, the position in it, and the member inside that position, so the refusal points at exactly the value that has to change however deep the structure runs.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "security_event",
        content: {
          audience: ["https://receiver.lindorm.io/"],
          events: { "urn:lindorm:event:test": {} },
          // ⚠ THE ELEMENT IS ITSELF AN `aliases` IDENTIFIER — nesting one
          // inside another is not permitted (RFC 9493 §3.2.8) — harmless here
          // precisely because the row is a REFUSAL and nothing is ever emitted.
          // What it buys is a member BELOW a collection element: an element of
          // `identifiers` declares the same member set as the identifier holding
          // it, so it carries an `identifiers` of its own — and a path that
          // stopped growing at the index is unobservable at any shallower shape.
          // The fault itself is the ordinary one: `identifiers` is declared an
          // array and holds a string.
          subjectId: {
            format: "aliases",
            identifiers: [{ format: "aliases", identifiers: "not-an-array" }],
          } as never,
        },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: {
          claim: "subjectId",
          invalid: [
            {
              key: "subjectId.identifiers[0].identifiers",
              message: 'Claim "subjectId" must be an array',
            },
          ],
        },
      },
    ],
  },
  {
    id: "a-cwt-keying-one-member-by-both-its-label-and-its-name-is-refused",
    title:
      "a verify refuses a CWT whose member map carries one member at both its integer label and its text name",
    rationale:
      'A COSE map has two kinds of key (RFC 9052 §1.5), and CBOR keys them apart, so a member\'s integer label and its interoperable text name are two distinct map entries. They are also two renderings of ONE declared member, so a map carrying both says two things about one field and a decoder that merges them lets the last entry win. For an identity member that hands the identification to whoever wrote the map: an actor the issuer named `2 => "audited-service"` is re-read as a different party by appending one entry, and every allowlist and audit record downstream then names the wrong one. There is no safe winner to pick — the map is self-contradictory about the one fact the member exists to state — so it is refused, naming the label and the name that resolved together. The door is the VERIFYING one because that is what the rule has to survive: the token carries a real signature over the real key, so it passes every check before the claims layer, and the refusal has to come from the decoder rather than from anything upstream of it.',
    given: [
      {
        step: "token",
        via: "forged",
        wire: "cose",
        claim: "act",
        // ⚠ ONE MEMBER, TWO ROWS — the shape a JS object forbids and a CBOR map
        // permits, which is why this half of the step is a table. `2` is the
        // actor's `sub` label and `"sub"` is its interoperable name.
        carries: [
          { key: "2", keyedBy: "label", value: "audited-service" },
          { key: "sub", keyedBy: "name", value: "rogue-service" },
        ],
        // A REAL signature over the forged payload: the capability is that a
        // token which verifies is still refused, and a junk-signed one could not
        // state it.
        signature: "ec-sig",
      },
    ],
    when: [{ step: "verify" }],
    then: [
      {
        step: "rejects",
        error: "CoseError",
        data: { claim: "act", member: "sub", label: 2, key: "sub" },
      },
    ],
    unsupported: {
      jose: "the two keyings are a COSE fact (RFC 9052 §1.5) — a JOSE member has ONE spelling and no second key for the same member to arrive under",
    },
  },
  {
    id: "an-address-member-cannot-be-shadowed-by-its-own-look-alike",
    title:
      "a verify refuses an address whose undeclared member flips onto a member the address already states",
    rationale:
      "The collision rule is a property of an OPEN member set, not of any one claim, and the OIDC Core §5.1.1 address is where it was first measured: an undeclared member takes the house case flip, so `streetAddress` becomes `street_address` and lands on the member OIDC Core §5.1.1 already spells that way. Before the rule, the token's own key order decided which value a relying party read. An address is not an identity assertion, so the stakes are lower than the actor's — which is exactly why it is worth stating separately: a rule that defended only the claim somebody happened to be looking at would be a patch, and the next open structure to arrive would inherit the defect rather than the defence.",
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
          address: { street_address: "Storgatan 1", streetAddress: "Shadow Street 9" },
        },
      },
    ],
    when: [{ step: "verify" }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: {
          claim: "address",
          invalid: [
            {
              key: "address.streetAddress",
              message:
                'Members "streetAddress" and "street_address" both resolve to "streetAddress" in "address"',
            },
          ],
        },
      },
    ],
  },
  {
    id: "an-undeclared-structured-member-survives-both-cose-encodings",
    title:
      "an actor member aegis does not declare rides the compact COSE encoding as well as the interoperable one",
    rationale:
      "The compact encoding is a SIZE decision, and a size decision must not also be a content decision. A label map holds only the members the library has labels for, so an implementation that builds one from its label table alone drops everything else — the same domain call then produces two tokens that say different things, and the one that says less is the one a deployment turns on for efficiency. Nothing in the token records the loss, and the interoperable token that would have revealed it is the one nobody is minting. A COSE map admits both integer and text labels (RFC 9052 §1.5), so a member with no assigned label rides under its own name in the same map as the labelled ones.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "access_token",
        content: {
          subject: "user-1",
          audience: [RESOURCE],
          clientId: CLIENT,
          act: { subject: "service-1", email: "service-1@example.test" },
        },
        options: { format: "cwt", proprietary: true },
      },
    ],
    when: [
      { step: "mint" },
      { step: "verify", profile: "access_token", options: { audience: RESOURCE } },
    ],
    then: [
      { step: "accepts", format: { cose: "cwt" } },
      // The round trip THROUGH the compact encoding: the undeclared member comes
      // back, so it was not dropped on the way out. ⚠ The raw MAP — the declared
      // member under its integer label beside the undeclared one under its own
      // string key, in ONE map — is pinned by `classes/act-claim-wire.test.ts`,
      // through the independent inspector; a row's expectations are plain data
      // (the table is machine-convertible), and a CBOR label map is not.
      {
        step: "claims",
        expected: {
          act: { subject: "service-1", email: "service-1@example.test" },
        },
      },
    ],
    unsupported: {
      jose: "the compact label map is a COSE encoding, and JSON has no counterpart for it. A JSON object has ONE kind of key (RFC 8259 §4), so a JOSE member has one spelling and no second encoding to be dropped from; COSE has two (RFC 9052 §1.5), which is the whole of what this row is about",
    },
  },
  {
    id: "an-actor-that-identifies-nobody-is-reported-as-an-actor-stating-nothing",
    title:
      "an actor object carrying no member the token states is reported back as an empty actor, not as no actor",
    rationale:
      "An issuer and a reader of the same token must agree about what it says, and a library that writes a value it will not read back has broken that on its own output. `act` is the claim that says a delegation occurred (RFC 8693 §4.1), so an actor object with no members is a strange thing to write — but it is a thing an issuer CAN write, and once written the honest read of it is the object that is there. Reporting the claim as ABSENT instead would say the token names no actor when it names an empty one, which is a different statement and one the wire does not support. ⚠ The consequence a consumer must know is that the reported object is TRUTHY: a delegation is stated and the acting party is not identified, so a check that cares WHO is acting has to read a member rather than the container.",
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
          act: {},
        },
      },
    ],
    when: [{ step: "verify" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      { step: "claims", expected: { act: {} } },
    ],
  },
  {
    id: "an-authorized-actor-claim-states-who-may-become-the-actor",
    title:
      "a token naming an authorized actor carries it on the wire and reports it back under its own name",
    rationale:
      "`may_act` is the claim a delegation authorisation is written into (RFC 8693 §4.4). It is therefore a claim whose whole value is that a DIFFERENT party can read it later: a token that carried it under a spelling the exchange endpoint does not look for, or that lost it on the way back in, silently turns every delegation the issuer authorised into one that cannot be exercised. The claim is the mirror of `act` — one records a delegation that happened, the other permits one that has not — so it is stated separately rather than assumed to follow from its twin.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "access_token",
        content: {
          subject: "user-1",
          audience: [RESOURCE],
          clientId: CLIENT,
          mayAct: { subject: "delegate-1", clientId: "delegate-client-1" },
        },
      },
    ],
    when: [{ step: "mint" }, { step: "verify" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      // The RAW WIRE, read by the INDEPENDENT inspector, in each wire's own
      // vocabulary. The member spellings are RFC 8693's on both encodings; the
      // CLAIM key is a separate question, and the interoperable default answers
      // it with the string name and NOT the private-use integer label the compact
      // encoding uses — integer values below -65536 are Private Use in the
      // registry a CWT CLAIM KEY comes from (RFC 8392 §9.1.1), so an
      // interoperable token must not carry one. (RFC 8152 §16.2 is the same rule
      // for a COSE HEADER PARAMETER — a different registry.)
      {
        step: "wireClaims",
        on: "jose",
        includes: { may_act: { sub: "delegate-1", client_id: "delegate-client-1" } },
      },
      {
        step: "wireClaims",
        on: "cose",
        present: ["may_act"],
        excludes: [-65543],
      },
      // …and back under its DOMAIN name, so the claim survives the round trip
      // rather than merely reaching the wire.
      {
        step: "claims",
        expected: { mayAct: { subject: "delegate-1", clientId: "delegate-client-1" } },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Temporal options that must not bleed into one another.
  // ---------------------------------------------------------------------------
  {
    id: "a-freshness-bound-survives-a-waived-issued-at-range-check",
    title:
      "a token older than the caller's freshness bound is refused even when the issued-at range check was waived",
    rationale:
      "The two options bound `iat` from OPPOSITE ends. `iat` is when the token was issued (RFC 7519 §4.1.6); the range check is the UPPER bound that refuses a token stamped in the future, a freshness bound is the LOWER one that refuses a token stamped too long ago. A caller accepting a future-dated token — a clock it does not control — is not thereby accepting a stale one, so folding the two into a single condition turns a narrow waiver into the removal of the bound the caller explicitly asked for in the same call.",
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
      "A small leeway for clock skew is allowed when checking `exp` (RFC 7519 §4.1.4). The profiled call and the profile-less one are separate forwards of the same bag, so a leeway honoured by one and dropped by the other means the identical token verifies or fails depending only on whether the caller named a profile — and the direction the drop falls in is the strict one, which reads as a broken issuer rather than a broken verifier. The token here sits ON the boundary rather than comfortably inside it, so the allowance is stated as an inclusive width and not merely as a switch that was flipped.",
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
      "The leeway allowed for clock skew is a bounded allowance and not a suspension of the expiry check (RFC 7519 §4.1.4). The MAGNITUDE is therefore the rule: a leeway applied in a unit other than the one the caller stated, or scaled on the way in, still accepts every token an honest one would and is invisible to any test that only widens the window. This row and its accepting twin sit one second apart around the same stated tolerance, so the window has exactly the width the caller asked for and a deployment allowing a minute of skew cannot be made to accept an hour of it.",
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
      "A `kid` is chosen by whoever wrote the token, so resolving it against every key the process knows lets the PRESENTER decide which issuer's key answers — and two issuers may legitimately publish the same `kid`, since distinctness is scoped to ONE key set (RFC 7517 §4.5). ⚠ Scoping the lookup by issuer is AEGIS POLICY, not a citation: no specification tells an implementation how to index the keys it has collected. It exists because the alternative has no safe ordering — a signature checked against a second issuer's colliding key succeeds, and the `iss` comparison that would catch it runs afterwards, by which point the verifier has already accepted material from a party the caller excluded. Refusing at RESOLUTION is what makes the caller's restriction mean 'these keys' rather than 'these keys, eventually'.",
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
      "`iss` is the claim that identifies the principal that issued the token, on either wire (RFC 7519 §4.1.1, RFC 8392 §3.1.1). A key registered under the pinned issuer only says the pinned issuer's material signed the bytes; the CLAIM is what the token says about who issued it, and the two can disagree — a deployment signing on behalf of a tenant, a key shared between environments. So the claim comparison is a separate check from the key scope, and skipping it once the key resolves believes the token's own account of its origin.",
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
      "Explicit typing is what stops a token issued for one purpose being replayed where another is expected, and the access token has a media type of its own (RFC 8725 §3.11, RFC 9068 §2.1). Naming a profile is how a caller says which kind it expects, so the profile's own type has to be checked against the token's — otherwise an id token, which the same issuer signs with the same key, is accepted wherever an access token is demanded, and every subsequent claim check passes because the two profiles overlap.",
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
      "`iat` is REQUIRED in a JWT access token, and the same claim rides the COSE wire (RFC 9068 §2.2, RFC 8392 §3.1.6). A required-claim rule enforced only where THIS deployment mints constrains its own output and says nothing about the token that actually arrived, which is the only one a verifier is defending against: the issuer of a hostile token is not running our mint.",
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
      "The floor must demand exactly what the profile declares. `iat` is OPTIONAL (RFC 7519 §4.1.6), so a profile written for a third party's assertion does not require it, and a floor that demanded it anyway would refuse conformant tokens from every partner while reporting a policy violation the partner cannot act on. This is the same rule as its refusing twin, read from the other side: the profile decides, not the floor.",
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
      'Presence has to mean the same thing at issue and on arrival. `jti` is the identifier a replay check keys on (RFC 7519 §4.1.7), and an identifier of `""` identifies nothing — every token carrying one collides with every other, so a replay store keyed on it stops distinguishing tokens at exactly the moment it matters. A presence rule satisfied by an empty value guarantees nothing while reporting that it does.',
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
      "Most profiles issue in the deployment's own name, but an assertion made BY a client is issued by that client: `iss` names the principal that issued the token (RFC 7519 §4.1.1), and here the principal is the caller, not the platform. So the issuer has to travel from the mint content to the wire claim and back — a mint that stamped the deployment's identity instead would produce a token the receiving party rejects for naming the wrong issuer, and it would do so silently, because the token is otherwise well-formed.",
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
    id: "a-subject-identifier-must-carry-the-member-that-identifies-the-subject",
    title:
      "minting a security event token whose subject identifier holds an empty member is refused",
    rationale:
      "A format's required members must not be null or empty — for `iss_sub`, both `iss` and `sub` (RFC 9493 §3.2.3). An identifier whose required member is an empty string therefore is not one, however well-formed it looks. It matters most on a security event token, whose whole purpose is to say that something happened to a specific subject: the `security_event` profile additionally FORBIDS a plain `sub` (an aegis policy, for SSF conformance and SET/ID-token anti-confusion — `sub` is OPTIONAL in RFC 8417 §2.2), which leaves the subject identifier as the entire statement of who the event is about. One that names nobody makes the event unattributable to the receiver acting on it. A demand for a member is a demand for the value, at whatever depth the member sits. The refusal names the position in the DOMAIN vocabulary the caller wrote the claim in — the caller stated `subjectId` and never saw `sub_id`, and the same `invalid` field carries the policy floor's own domain-named entries, so a wire-spelled position would make one field mean two things.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "security_event",
        content: {
          audience: ["https://receiver.lindorm.io/"],
          subjectId: { format: "iss_sub", iss: ISSUER, sub: "" },
          events: { "urn:lindorm:event:test": {} },
        },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: {
          direction: "mint",
          invalid: [
            {
              key: "subjectId.sub",
              message: 'subjectId of format "iss_sub" requires member "sub"',
            },
          ],
        },
      },
    ],
  },
  {
    id: "a-subject-identifier-is-stated-in-the-vocabulary-the-caller-speaks",
    title:
      "a subject identifier member is written and read back in the domain vocabulary while the wire keeps the RFC spelling",
    rationale:
      "The domain surface exists so a caller states claims in ONE vocabulary and never has to know the wire's — it takes `tokenId` and returns `tokenId`, it takes `streetAddress` for OIDC Core §5.1.1's `street_address`, and RFC 9493's Subject Identifier is no different. Its `phone_number` member (RFC 9493 §3.2.5) is the only member of any structured claim spelled with an underscore, so a caller writing it would otherwise have had to know that this one structure answered in the wire's words while every other one answered in the house's. The wire is what interoperability is made of and must keep the RFC's own spelling; the two are separate statements, and stating them together is what shows the translation happening rather than a value being copied. It matters beyond taste because the per-format requirement table is keyed by the DOMAIN name: a member the domain surface spells one way and the rule looks up another is a requirement RFC 9493 §3.2.5 makes and nothing enforces.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "security_event",
        content: {
          audience: ["https://receiver.lindorm.io/"],
          // The Phone Number format, whose REQUIRED member (RFC 9493 §3.2.5) is the one
          // this vocabulary question is about — so the profile's own shape rule
          // has to resolve the domain spelling for the mint to succeed at all.
          subjectId: { format: "phone_number", phoneNumber: "+46700000000" },
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
      // The DOMAIN half: what the caller wrote is what the caller gets back.
      {
        step: "claims",
        expected: { subjectId: { format: "phone_number", phoneNumber: "+46700000000" } },
      },
      // The WIRE half, read off the raw bytes: the member is `phone_number`
      // there (RFC 9493 §3.2.5), and a receiver of this token is not a lindorm
      // consumer.
      // Without this the row would pass for a package that never translated
      // anything and simply echoed the caller's key onto a signed token.
      {
        step: "wireClaims",
        on: "jose",
        includes: { sub_id: { format: "phone_number", phone_number: "+46700000000" } },
      },
    ],
  },
  {
    id: "an-identifier-format-the-issuer-does-not-model-is-carried-not-refused",
    title:
      "a security event token whose subject identifier names an unmodelled Identifier Format is minted and verified",
    rationale:
      "An Identifier Format's name is either registered or a Collision-Resistant Name, and the second needs no registration at all (RFC 9493 §3), so a conformant transmitter can name a format this implementation has never heard of. A format may also describe more members than are strictly necessary to identify a subject (RFC 9493 §3), so what those members are is that format's business and not the reader's. A receiver that refused an unmodelled format would reject conformant security events, and the deployment's only remedy would be to stop using the profile. So an unmodelled format carries no per-format demand and the identifier travels intact. The format name is a PRODUCER'S string with no grammar constraining it, which is why this row states the rule with a name drawn from `Object.prototype`: a lookup table reached by such a name must answer \"unknown format\", and any other answer — a refusal, or a crash escaping the error contract — is the implementation's own vocabulary leaking into the specification's.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "security_event",
        content: {
          audience: ["https://receiver.lindorm.io/"],
          subjectId: { format: "constructor", id: "subject-1" },
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
      // Both doors, because the per-format table is consulted on the mint path AND
      // again on the verify floor — so a row stopping at `mint` would state the
      // rule for the data aegis writes and say nothing about the data it reads.
      {
        step: "claims",
        expected: { subjectId: { format: "constructor", id: "subject-1" } },
      },
    ],
  },
  {
    id: "an-authorization-detail-must-name-the-type-that-scopes-it",
    title: "minting a token whose authorization detail carries an empty type is refused",
    rationale:
      "`type` is REQUIRED on every authorization details element, and its value determines the allowable contents of the object that contains it (RFC 9396 §2) — it is the identifier a resource server dispatches on. An element typed with an empty string names no type, so nothing can be looked up to interpret the rest of the element, and a resource server matching on type finds no match while the token appears to carry a granted authorization. The element states an authorization it gives no one a way to honour. The demand is the claim's own shape, not one profile's appetite: it holds for every token that carries the claim, which is why this row states it under a profile that says nothing about authorization details at all.",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "default",
        content: {
          subject: "user-1",
          expires: "1h",
          audience: [RESOURCE],
          clientId: CLIENT,
          authorizationDetails: [{ type: "" }],
        },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: {
          claim: "authorizationDetails",
          invalid: [
            {
              key: "authorizationDetails[0].type",
              message: 'Member "type" is required and must not be empty',
            },
          ],
        },
      },
    ],
  },
  {
    id: "a-verifier-refuses-an-authorization-detail-that-names-no-type",
    title:
      "verifying a token whose authorization detail carries no type at all is refused",
    rationale:
      "`type` determines the allowable contents of the element that carries it (RFC 9396 §2), so a presented element without one has no defined contents to read. Neither of the two silent dispositions is honest: dropping the element reports fewer authorizations than the token states, which misrepresents what its issuer signed, and keeping it hands a resource server a grant nobody defined and that no type-specific rule can be applied to. A verifier must therefore refuse the token rather than report an interpretation of it.",
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
          // A producer that is not aegis wrote this element, so the write-side
          // refusal never saw it. Only the read can speak about it.
          //
          // ⚠ The cast is the point of the row, not a workaround for it:
          // `JwtClaimsWire` types the element with a REQUIRED `type` (RFC 9396
          // §2), so this shape cannot be written in our own vocabulary at all —
          // which is exactly why only a foreign producer can put it in front of
          // a verifier, and why the verifier owes an answer for it.
          authorization_details: [
            { locations: [RESOURCE] },
          ] as unknown as JwtClaimsWire["authorization_details"],
        },
      },
    ],
    when: [{ step: "verify", profile: "default", options: { audience: RESOURCE } }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: {
          claim: "authorizationDetails",
          invalid: [
            {
              key: "authorizationDetails[0].type",
              message: 'Member "type" is required and must not be empty',
            },
          ],
        },
      },
    ],
  },
  {
    id: "an-authorization-detail-typed-with-an-empty-string-is-refused-when-read",
    title:
      "verifying a token whose authorization detail is typed with an empty string is refused",
    rationale:
      "`type` is required, and its VALUE is what determines the allowable contents of the element (RFC 9396 §2) — so the demand is for an identifier, not for the key being spelled. An empty string is a present key naming no type at all: nothing can be looked up to interpret the element, and a resource server dispatching on type finds no match while the token still appears to carry a granted authorization. A reader that accepted it would let a producer satisfy the requirement by writing the field and leaving it blank, which is the requirement not existing.",
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
          // PRESENT but EMPTY — the case that separates a demand for a value
          // from a demand for a key. Cast for the same reason as the sibling
          // rows: `JwtClaimsWire` types `type` as a required string, so only a
          // foreign producer can put this in front of a verifier.
          authorization_details: [
            { type: "" },
          ] as unknown as JwtClaimsWire["authorization_details"],
        },
      },
    ],
    when: [{ step: "verify", profile: "default", options: { audience: RESOURCE } }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: {
          claim: "authorizationDetails",
          invalid: [
            {
              key: "authorizationDetails[0].type",
              message: 'Member "type" is required and must not be empty',
            },
          ],
        },
      },
    ],
  },
  {
    id: "reading-a-token-without-its-key-still-refuses-a-structure-it-cannot-state",
    title:
      "the keyless read of a token whose authorization detail names no type is refused, and reports no other claim either",
    rationale:
      "A keyless read skips the SIGNATURE and the profile floor; it does not skip deciding what the token SAYS, and that is the whole of what it returns. An element's `type` determines its allowable contents (RFC 9396 §2), so an element without one has no contents to report — and a reader that answered anyway would be publishing an interpretation of a structure it cannot interpret, with no signature check behind it to qualify the answer. The refusal is therefore owed on the unverified door exactly as on the verified one. ⚠ Its cost is stated by this row rather than discovered: the read is ALL-OR-NOTHING, so one malformed claim denies the caller every other claim in the token — a caller that needs to inspect a possibly-malformed token must read it through a surface that performs no claim translation.",
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
          // Cast for the same reason as the sibling rows: `JwtClaimsWire` types
          // `type` as REQUIRED, so only a foreign producer can write this.
          authorization_details: [
            { locations: [RESOURCE] },
          ] as unknown as JwtClaimsWire["authorization_details"],
        },
      },
    ],
    // The KEYLESS door specifically. Every other row about this claim states
    // `verify`, which reaches the translator through the signature check — so
    // none of them can say whether the rule survives without one.
    when: [{ step: "parse" }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: {
          claim: "authorizationDetails",
          invalid: [
            {
              key: "authorizationDetails[0].type",
              message: 'Member "type" is required and must not be empty',
            },
          ],
        },
      },
    ],
  },
  {
    id: "an-authorization-details-claim-that-is-not-a-list-of-objects-is-refused",
    title:
      "verifying a token whose authorization details claim is a bare string is refused",
    rationale:
      "The claim carries an array of objects, each holding the data for one type of resource (RFC 9396 §14.2). A scalar is not a shorter form of that array — there is no element for a `type` to scope, and nothing a resource server could dispatch on — so a token stating one grants nothing that can be read, while a reader that silently discarded the claim would report a token that made no authorization statement when its issuer signed one. The mismatch between what was signed and what is reported is the failure a refusal prevents.",
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
          // Not an array at all. Same reason for the cast as the row above:
          // the claim is an array of objects (RFC 9396 §14.2), so the type forbids
          // the shape and only somebody else's producer can emit it.
          authorization_details:
            "payment_initiation" as unknown as JwtClaimsWire["authorization_details"],
        },
      },
    ],
    when: [{ step: "verify", profile: "default", options: { audience: RESOURCE } }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: {
          claim: "authorizationDetails",
          invalid: [
            {
              key: "authorizationDetails",
              message: 'Claim "authorizationDetails" must be an array',
            },
          ],
        },
      },
    ],
  },
  {
    id: "a-profile-that-states-no-lifetime-accepts-a-token-carrying-no-expiry",
    title:
      "a security event token carrying no expiry verifies under the profile that issues it",
    rationale:
      "`exp` is NOT RECOMMENDED in a security event token (RFC 8417 §2.2), so a conformant SET normally carries none, while an access token with none never stops working — the same absence, opposite consequences. Expiry PRESENCE is consequently the PROFILE'S policy to state: a profile declaring a lifetime keeps the requirement, one declaring none must waive it, or this package cannot issue the shape its own specification recommends and every receiver of one refuses it.",
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
      // shows the profile is usable and not merely acceptable: `sub_id` is a
      // structured Subject Identifier (RFC 9493 §3), and it is the whole statement
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
      // lifetime at all. `exp` is COSE label 4 (RFC 8392 §3.1.4).
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
      "A MAC proves that SOMEBODY holding the secret produced the token, and every party that can verify holds it — so a shared secret cannot establish who issued anything. An access token is presented to a party that is not the issuer, which is exactly the case the distinction exists for. The restriction is the verifier's to state and the library's to honour (RFC 8725 §3.1). The rule must bite on ARRIVAL, because a constraint applied only where this deployment signs defends nobody against a token this deployment did not write.",
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
      "A signature and a MAC both secure content (RFC 7515 §1), and the two say different things about origin: everyone who can VERIFY a MAC can also PRODUCE one, so a MAC establishes only that some holder of the secret wrote the token. A profile whose whole purpose is to accept tokens from an authorization server we do not control is the case where that matters most — the deployment holds the same secret it would be relying on to prove the third party issued the token, so it could equally have written it itself. The restriction is the verifier's to state and the library's to enforce (RFC 8725 §3.1).",
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
      "A delegation designation names the client that issued it as its own `iss`, so the platform receiving it is being asked to act on an attribution. A signature and a MAC both secure content (RFC 7515 §1), and a MAC is symmetric: the receiving platform holds the same secret and could have written the designation itself, so the attribution it carries is unfalsifiable and therefore worthless. Only a signature made by the client's own registered key lets the platform say who designated whom. The restriction belongs where it can be enforced — with the verifier (RFC 8725 §3.1).",
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
      "The class floor is the PROFILE'S rule and not a blanket ban, and the difference is load-bearing. A security event token must be authenticated, with no algorithm class imposed (RFC 8417 §5.1), and a JWS secures content with either a digital signature or a MAC (RFC 7515 §1). A SET is delivered to a receiver the transmitter already has a relationship with, so a shared secret is a conformant and ordinary choice there. A floor applied to every profile would refuse it, and the remedy a deployment reaches for is to stop using the profile — which discards every other rule it carried along with the one that was wrong.",
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
      "`auth_time` is the time the End-User authentication occurred, carried as a count of seconds since the epoch (OIDC Core §2). The DOMAIN shape of such a claim is an instant and its WIRE shape is that number, so the encoder is what stands between them — and it fails in the one direction nothing reports: a value it does not recognise as an instant encodes to nothing, which drops the claim from the token without an error, so the issuer believes it stated an authentication time and the audience receives none.",
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
      "Several registered claims are LISTS: an array of strings is the general form of `aud` (RFC 7519 §4.1.3), and `scope` is a space-separated list of scopes (RFC 8693 §4.2) — the authorisation claims beside it follow the same shape. A caller naming ONE value of such a claim is asking whether the list contains it, which is the only question a single identity can pose: it never expects the list to consist of that value alone. A matcher compiled to an equality test answers `false` for every such claim, so the whole family becomes unassertable at once — and these are the claims authorisation is decided on.",
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
    id: "the-static-claim-matcher-accepts-a-conjunction-every-member-of-which-holds",
    title:
      "a caller stating a conjunction to the static claim matcher is answered by a claim set satisfying every member",
    rationale:
      "The static matcher takes the same matcher argument as verify, and a matcher argument is a condition that composes. A surface that read a conjunction as a claim name would find no such claim in any set and refuse every caller who composed one, so the accepting direction shows the composition was compiled rather than named.",
    given: [{ step: "claims", claims: { subject: "user-1", clientId: CLIENT } }],
    when: [
      {
        step: "static-assert",
        assert: { $and: [{ subject: "user-1" }, { clientId: CLIENT }] },
      },
    ],
    then: [{ step: "accepts" }],
  },
  {
    id: "the-static-claim-matcher-names-a-conjunction-one-member-of-which-fails",
    title:
      "a caller stating a conjunction to the static claim matcher is refused by a claim set failing one member, under the conjunction's own key",
    rationale:
      "The refusal names the TOP-LEVEL entries of the matcher argument that did not hold, and a root operator is a top-level entry of its own: the caller wrote `$and`, and `$and` is what did not hold. A conjunction fails as a whole, and its failing member is not always a single claim, so the entry the caller wrote is the one reported.",
    given: [{ step: "claims", claims: { subject: "user-1", clientId: CLIENT } }],
    when: [
      {
        step: "static-assert",
        assert: { $and: [{ subject: "user-1" }, { clientId: "someone-else" }] },
      },
    ],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: { invalid: ["$and"] },
      },
    ],
  },
  {
    id: "the-static-claim-matcher-accepts-a-disjunction-on-its-second-member",
    title:
      "a caller stating a disjunction to the static claim matcher is answered by a claim set satisfying only its second member",
    rationale:
      "A disjunction holds when any member does, and the member that holds must not have to be the first. A surface evaluating only the first member would refuse every claim set the caller admitted through the second, and would look correct on every check that names the accepted identity first.",
    given: [{ step: "claims", claims: { subject: "user-1" } }],
    when: [
      {
        step: "static-assert",
        assert: { $or: [{ subject: "someone-else" }, { subject: "user-1" }] },
      },
    ],
    then: [{ step: "accepts" }],
  },
  {
    id: "the-static-claim-matcher-names-a-negation-whose-payload-matches",
    title:
      "a caller negating a claim matcher at the static claim matcher is refused by a claim set matching it, under the negation's own key",
    rationale:
      "A negation fails exactly when its payload holds, and the refusal names the entry that failed: `$not`. The claim inside the negation matched, so naming it as failing would tell the caller the opposite of what happened. The diagnosis evaluates each top-level entry against the whole claim set because a negation has no claim of its own to read.",
    given: [{ step: "claims", claims: { subject: "user-1" } }],
    when: [{ step: "static-assert", assert: { $not: { subject: "user-1" } } }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        data: { invalid: ["$not"] },
      },
    ],
  },
  {
    id: "the-static-claim-matcher-derives-no-hash-from-a-raw-source",
    title: "a raw hash source presented to the static claim matcher matches nothing",
    rationale:
      "`at_hash` is derived with the hash function the token's signing `alg` selects (OIDC Core §3.1.3.6), and `alg` is a HEADER parameter. This surface is handed a flat claim dict with no header, so it cannot know which function to apply — a surface that guessed would produce a digest that matches for one algorithm and silently fails for every other, which is indistinguishable from a substituted access token. The division is therefore structural, not an omission: the key-holding verify derives, and this one matches the digest mint already wrote.",
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
      "`exp` is the instant on or after which a token must not be accepted for processing (RFC 7519 §4.1.4), and that obligation belongs to whoever is processing the claims — it does not lapse because the signature was checked upstream. Applying the bound by DEFAULT is what retires the hand-rolled `exp > now` a caller would otherwise write, and a hand-rolled one carries no clock tolerance, so a claim set inside the verified arm's skew window passes there and fails here.",
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
      "`exp` is OPTIONAL (RFC 7519 §4.1.4), and a whole class of conformant tokens sits on the other side of that: it is NOT RECOMMENDED in a security event token (RFC 8417 §2.2). A RANGE bound that treated an absent claim as a failed one would refuse every such claim set — and would report the refusal as an expiry, which points whoever reads it at a clock rather than at a claim that was never there. Whether the claim must be PRESENT is a different question, and it is answered by a different policy.",
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
      "A small leeway for clock skew is provided for (RFC 7519 §4.1.4). The leeway is the deployment's to choose and it is the reason this surface applies the window at all rather than leaving it to the caller: a hand-rolled comparison has no leeway, so the two arms disagree for exactly the claim sets skew produces — the ones that arrive at the boundary of the window, intermittently, in production.",
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
      "A token must not be accepted for processing before the time `nbf` names (RFC 7519 §4.1.5). It is a hard lower bound and it is the one most often left out of a hand-rolled check, because the credential looks complete and its expiry has not passed; a claim set issued for a future window is then honoured for the whole interval before that window opens.",
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
      "`auth_time` is the time the End-User authentication occurred (OIDC Core §2), so a value in the future describes an authentication that has not happened — a claim set no honest issuer produces. It is checked ON REQUEST rather than always because, unlike `exp` and `nbf`, the claim carries no processing obligation of its own: it is an input to a relying party's freshness policy, and a party that states no such policy has not asked for anything to be enforced.",
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
      "A relying party bounds how long ago authentication may have happened (OIDC Core §3.1.2.1, OIDC Core §3.1.3.7); the same bound applies to a claim set read out of a cache or an introspection response, where the age is the only thing separating a current answer from a stale one. It is a TIGHTENING option — it can only refuse claim sets that would otherwise pass — so dropping it is always the unsafe direction, and it leaves no trace: a stale claim set passing looks exactly like a fresh one.",
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
      "`iat` is OPTIONAL (RFC 7519 §4.1.6), so a claim set may legitimately carry none — and a freshness bound cannot be evaluated against a claim that is absent. The bound must therefore fail CLOSED: treating an unstated issuance as satisfying every age limit means the way to defeat the bound is to omit the claim, which is the one thing the party presenting the claim set can always do.",
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
  // -------------------------------------------------------------------------
  // `aegis.sign` — the PROFILE-LESS domain sign verb
  // -------------------------------------------------------------------------
  {
    id: "a-profile-less-signature-states-its-claims-in-the-wires-own-vocabulary",
    title:
      "a signature made without a profile still writes domain claims under the registered wire keys",
    rationale:
      "A claim's wire spelling is fixed by specification and not by which verb wrote it: the subject is `sub` on JOSE and integer label 2 on COSE (RFC 7519 §4.1.2, RFC 8392 §3.1.2), and the token id is `jti` and label 7 (RFC 7519 §4.1.7, RFC 8392 §3.1.7). An issuer that has no profile to apply is still issuing a token a third party must read, so writing the caller's domain names to the wire would produce a token that carries no registered claim at all — it would verify, and every audience would find it empty.",
    given: [
      { step: "keys", keys: ["ec-sig"] },
      {
        step: "token",
        via: "domain-sign",
        claims: { subject: "user-1", tokenId: "token-1", clientId: CLIENT },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      // Read off the BYTES by the independent inspector. The two spellings are
      // different assertions about one domain fact, so they are scoped per wire.
      {
        step: "wireClaims",
        on: "jose",
        includes: { sub: "user-1", jti: "token-1", client_id: CLIENT },
        excludes: ["subject", "tokenId"],
      },
      {
        step: "wireClaims",
        on: "cose",
        // 2 = sub, 7 = cti. `client_id` has no registered CWT label, so it keeps
        // its text key — the honest answer, and the one a foreign reader gets.
        present: [2, 7],
        includes: { 2: "user-1", client_id: CLIENT },
        excludes: ["subject", "tokenId", "sub", "jti"],
      },
    ],
  },
  {
    id: "a-profile-less-signature-adds-no-claim-the-caller-did-not-state",
    title: "a signature made without a profile carries exactly the claims it was given",
    rationale:
      "The profile is what generates an envelope — the issuer identity, the issue instant, the token id, the lifetime-derived expiry — and enforces the policy that requires them. A verb that applies no profile must therefore assert nothing on the issuer's behalf: a token that silently gained an `iss` would name this deployment as the authority for a statement it was not asked to make, and one that gained an `exp` would be honoured for a window nobody chose. Absence here is what makes the profiled floor meaningful, since a floor that also applied without a profile would not be a floor.",
    given: [
      { step: "keys", keys: ["ec-sig"] },
      {
        step: "token",
        via: "domain-sign",
        claims: { subject: "user-1" },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      { step: "wireClaims", on: "jose", excludes: ["iss", "iat", "exp", "jti", "nbf"] },
      // The same five claims at their RFC 8392 §3.1 labels: 1 iss, 6 iat, 4 exp,
      // 7 cti, 5 nbf.
      { step: "wireClaims", on: "cose", excludes: [1, 6, 4, 7, 5] },
    ],
  },
  {
    id: "a-profile-less-signature-declares-the-callers-token-type",
    title: "a signature made without a profile stamps the token type the caller named",
    rationale:
      "An explicit type header is what lets a recipient refuse a token issued for another purpose, and COSE carries the same parameter at label 16 (RFC 8725 §3.11, RFC 9596 §2, RFC 9596 §4.1). Without a profile there is no mandated type, so the caller's own is the only statement available — dropping it would leave every profile-less token indistinguishable from every other, which is the confusion the recommendation exists to prevent.",
    given: [
      { step: "keys", keys: ["ec-sig"] },
      {
        step: "token",
        via: "domain-sign",
        claims: { subject: "user-1" },
        options: { tokenType: "access_token" },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      // One media type, two spellings: the JOSE suffix is `+jwt` and the COSE one
      // `+cwt`, at the COSE type header parameter's own label (RFC 9596 §2,
      // RFC 9596 §4.1).
      //
      // ⚠ THE WHOLE COSE SPELLING IS AEGIS POLICY, and this is the one place that
      // says so for every `<prefix>+cwt` these rows state. `+cwt` is an aegis
      // construction: RFC 8392 §9.2 registers `application/cwt` and no structured
      // suffix, and no document in the local corpus defines one. Keeping the
      // `application/` prefix is aegis's too: RFC 7515 §4.1.9 RECOMMENDS a
      // producer omit it.
      {
        step: "wireProtectedHeader",
        on: "jose",
        includes: { typ: "application/at+jwt" },
      },
      {
        step: "wireProtectedHeader",
        on: "cose",
        includes: { 16: "application/at+cwt" },
      },
    ],
  },
  {
    id: "a-profile-less-signature-verifies-as-the-token-it-declares-itself-to-be",
    title:
      "a token signed without a profile is read back through the ordinary verify path",
    rationale:
      "A signature is only worth making if the artifact can be read by the ordinary reader, and the reader is told nothing about which verb wrote a token — it detects the wire from the bytes. A profile-less token that could not travel the normal read path would be a token only its author could use, which is not a token.",
    given: [
      { step: "keys", keys: ["ec-sig"] },
      {
        step: "token",
        via: "domain-sign",
        // The read-side floor is the profile-less one and it still applies: the
        // JOSE read requires an issuer and both wires require an expiry.
        claims: {
          issuer: ISSUER,
          subject: "user-1",
          // The table's date cell, cast locally as every typed claim bag does —
          // a row holds no live `Date`, and the interpreter revives it.
          expiresAt: { date: EXPIRES_AT } as unknown as Date,
        },
      },
    ],
    when: [{ step: "verify" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      { step: "claims", expected: { issuer: ISSUER, subject: "user-1" } },
    ],
  },
  {
    id: "a-token-type-with-no-structured-media-type-leaves-the-wires-own-bare-form",
    title:
      "a token type that has no structured media type stamps each wire's own conventional type header",
    rationale:
      "Not every token type has a structured media type to name. An ID Token is a plain JWT (OIDC Core §2) with no `id+jwt` type registered for it, so there is no `application/<prefix>+<format>` to build and what remains is the conventional value of whichever format is being written. Those values are not one string: on JOSE this one is the abbreviated form `JWT` (RFC 7515 §4.1.9, RFC 7519 §5.1) while the COSE type header takes a media type in full (RFC 9596 §2, RFC 9052 §3.1) — here `application/cwt` (RFC 8392 §9.2). Answering the JOSE spelling on a COSE write is not a cosmetic mis-stamp — it is not a representable COSE type header at all, so the token cannot be produced and the caller loses the whole artifact rather than one parameter.",
    given: [
      { step: "keys", keys: ["ec-sig"] },
      {
        step: "token",
        via: "domain-sign",
        claims: { subject: "user-1" },
        options: { tokenType: "id_token" },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      { step: "wireProtectedHeader", on: "jose", includes: { typ: "JWT" } },
      { step: "wireProtectedHeader", on: "cose", includes: { 16: "application/cwt" } },
    ],
  },
  {
    id: "a-caller-stated-type-header-overrides-the-derived-one-on-either-wire",
    title:
      "an explicitly stated type header replaces the one derived from the token type, on both wires",
    rationale:
      "An issuer with no profile to obey is the only authority on what its token is for, and an explicit type is the mechanism a recipient uses to refuse a token issued for something else (RFC 8725 §3.11). Honouring the statement on one encoding and dropping it on the other is worse than not offering it: the caller sets the option once and gets a typed token or an untyped one depending on a format choice made for unrelated reasons, with nothing in either result to say which happened. The value is stated in the JOSE spelling on either wire because the kits re-wrap the bare PREFIX in their own format, exactly as a profile's mandated type is rewritten from `+jwt` to `+cwt`.",
    given: [
      { step: "keys", keys: ["ec-sig"] },
      {
        step: "token",
        via: "domain-sign",
        claims: { subject: "user-1" },
        // Both stated: the explicit header must WIN, so a row that named only
        // `typ` could not tell honouring it from ignoring the other.
        options: { tokenType: "access_token", typ: "custom+jwt" },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      { step: "accepts", format: { jose: "jwt", cose: "cwt" } },
      {
        step: "wireProtectedHeader",
        on: "jose",
        includes: { typ: "application/custom+jwt" },
      },
      {
        step: "wireProtectedHeader",
        on: "cose",
        includes: { 16: "application/custom+cwt" },
      },
    ],
  },
  {
    id: "a-scope-member-containing-a-space-is-refused-by-the-profile-less-sign-verb",
    title:
      "signing a payload without a profile refuses a scope list whose member contains a space",
    rationale:
      "The wire spelling of `scope` — one space-delimited string — belongs to the token wire, not to a profile, so a member containing a space has no spelling whichever verb writes the token. The profile-less sign verb refuses it at the same position and under the same code as the profiled mint — aegis policy at mint (RFC 6749 §3.3) — because a verb that applies no profile is still an issuer, and its reader, like every other, would report a list the caller never stated.",
    given: [
      {
        step: "token",
        via: "domain-sign",
        claims: { subject: "user-1", scope: ["read write"] },
      },
    ],
    when: [{ step: "mint" }],
    then: [
      {
        step: "rejects",
        error: "AegisDomainError",
        code: "claim_structure_invalid",
        data: {
          claim: "scope",
          invalid: [
            { key: "scope[0]", message: 'Member "scope[0]" must not contain a space' },
          ],
        },
      },
    ],
  },
  {
    id: "an-option-a-wire-cannot-honour-is-refused-rather-than-dropped",
    title:
      "an encrypt refuses an option its wire cannot honour, rather than accepting and ignoring it",
    rationale:
      "An option a writer cannot act on has exactly two honest dispositions: do it, or say so. Accepting and ignoring is the third, and it is the worst — the caller states a requirement, receives a token, and nothing anywhere reports that the requirement is absent from it. A wire that cannot carry a value must therefore refuse the request rather than issue a token the caller believes carries it. A COSE_Encrypt0 carries no recipients array and runs no recipient algorithm, so there is no key-agreement step to derive party info from (RFC 9052 §5.2, RFC 7518 §4.6).",
    given: [
      { step: "keys", keys: ["ec-enc", "oct-enc"] },
      {
        step: "token",
        via: "domain-encrypt",
        data: { subject: "user-1" },
        options: { partyProducer: "cHJvZHVjZXI" },
      },
    ],
    when: [{ step: "mint" }],
    // JOSE HONOURS the option — `JweKit` writes `apu` for its key-agreement
    // algorithms — so only the COSE wire refuses. That asymmetry is the
    // capability, not a shortfall: the row states what each wire does with the
    // same request.
    then: [
      {
        step: "rejects",
        on: "cose",
        // The stable discriminator, read off the real error. `AegisDomainError`
        // is a broad base, so the class alone would be satisfied by any domain
        // refusal at all — including one raised for an unrelated reason.
        // `code` is deliberately NOT pinned; see the note at the head of this file.
        error: "AegisDomainError",
        data: {
          format: "cwe",
          operation: "encryptContent",
          option: "partyProducer",
        },
      },
    ],
    unsupported: {
      jose: "the JOSE wire CAN honour the ECDH-ES party info: `apu`/`apv` are the key-agreement parameters (RFC 7518 §4.6) and `JweKit` writes them, so there is no refusal to state here. That it is honoured is held by the disposition probe row `\'jose\' \'encryptContent\' forwards \'partyProducer\'`, which spies on the kit call and therefore fails if the option stops arriving.",
    },
  },
  {
    id: "an-encrypted-token-reports-the-kind-of-the-token-inside-it",
    title:
      "a signed token wrapped in an encrypting envelope reports its own kind, with the envelope beside it",
    rationale:
      "A caller asking what a token IS must get one answer whether or not the issuer chose to encrypt it. An encrypted id_token is an id_token — encryption is how it travelled, not what it is — so a consumer routing on the token's kind must not have to know how it travelled. Reporting the envelope as the kind forces every such consumer to special-case encryption, and the ones that forget silently drop a whole class of valid credential: the claims are fully populated and only the tag says otherwise.",
    given: [
      { step: "keys", keys: ["ec-sig", "oct-enc"] },
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: { subject: "user-1", audience: [CLIENT] },
        options: { context: { accessTokenIssued: false }, encrypt: {} },
      },
    ],
    when: [{ step: "verify", profile: "id_token", options: { audience: CLIENT } }],
    then: [
      {
        step: "accepts",
        format: { jose: "jwt", cose: "cwt" },
        wrapper: { jose: "jwe", cose: "cwe" },
      },
      // The claims are the inner token's, fully populated — the envelope changes
      // how the token travelled and nothing about what it says.
      { step: "claims", expected: { subject: "user-1" } },
    ],
  },
  {
    id: "a-bare-encrypted-token-reports-its-own-format-and-no-wrapper",
    title:
      "a token that seals content rather than a token reports itself, with no wrapper",
    rationale:
      '`encrypt` seals a value; there is no token inside it and nothing encloses it, so its own kind IS the encrypting format. This is the case that makes the wrapper field load-bearing rather than cosmetic: `jwe` is a legitimate answer to "what is this token" in its own right, so `format` alone cannot distinguish a sealed blob from a signed token in an envelope. The presence of `wrapper` is the discriminator, and a consumer that branched on `format === "jwe"` to mean "something signed is inside" would be wrong for exactly this artifact.',
    given: [
      { step: "keys", keys: ["oct-enc"] },
      { step: "token", via: "domain-encrypt", data: { subject: "user-1" } },
    ],
    when: [{ step: "mint" }],
    then: [
      {
        step: "accepts",
        format: { jose: "jwe", cose: "cwe" },
        // ⚠ `null`, not omitted. The row's whole subject is the ABSENCE of a
        // wrapper, and omitting the field asserts nothing about it — which is
        // how a row named for a capability can prove none of it.
        wrapper: null,
      },
    ],
  },
];
