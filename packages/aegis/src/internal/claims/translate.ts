import { camelCase, camelKeys, snakeCase, snakeKeys } from "@lindorm/case";
import { getUnixTime } from "@lindorm/date";
import { isArray, isFinite, isObject, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import { AegisDomainError } from "../../errors/index.js";
import type { InvalidEntry } from "../../types/index.js";
import type {
  ArrayScalar,
  BespokeKind,
  ClaimCodec,
  ClaimMemberSpec,
  ObjectCodec,
} from "../registry/claim-spec.js";
import { isClaimSatisfied } from "../utils/rules/is-claim-satisfied.js";
import { type CnfMemberSpec, cnfMemberByDomain, cnfMemberByJose } from "./cnf-members.js";
import {
  CLAIM_SPECS,
  type ClaimSpec,
  claimByDomain,
  joseName,
  type NameSelector,
} from "./claims-registry.js";
import { isNotStated } from "./is-not-stated.js";
import { protoMemberViolations } from "./proto-member-violations.js";

/**
 * The ONE claim translator. It consolidates every claim mapper that existed
 * before — `map-content-to-claims.ts` (domain -> jose, write), the hand-written
 * `extractDomainClaims` (jose/camel -> domain, read), and the `domain <-> jose`
 * remap loops around `CWT_CLAIMS_KIT` in `cwt-claims.ts` — into a single
 * registry-driven, single-PASS pair per direction.
 *
 * ⚠ The read half of `extract-claims.ts` was not merely a second caller: it held
 * FIVE value decoders character-identical to the ones below (`toDate`,
 * `toStringArray`, `toAudience`, `toActClaim`, `toConfirmation`) plus a
 * hand-listed field-by-field extraction of ~45 claims. All of it is gone; what
 * genuinely differed survives as {@link ClaimReadMode}, and nothing else.
 * (`toActClaim` has since gone the rest of the way — the RFC 8693 actor chain is
 * a DECLARED, recursive member set now, walked by the generic walker below.
 * `toConfirmation` has gone too: it and its write twin are ONE declaration now,
 * `internal/claims/cnf-members.ts`, walked by the pair below.)
 *
 * TWO parameterized cores (write / read), and the wire is a PARAMETER of both.
 * The ONLY thing that varies between JOSE and COSE is the wire NAME emitted or
 * looked up — `joseName` vs `coseName` (the RFC 8392 divergence set, today just
 * `jti` <-> `cti`). The VALUE transforms are identical at this level; only the
 * downstream CWT codec turns the jose-shaped values into COSE labels and CBOR
 * bytes. The two cores are `domainToWire` and `wireToDomain`, each taking the wire
 * as a `NameSelector` argument; there is deliberately no `domainToCose` /
 * `coseToDomain` beside them, because a second named entry point per wire is a
 * second place for a rule to be written differently, which is exactly what this
 * file exists to remove.
 *
 * It is the ONLY domain-aware claim code: both the JOSE and the COSE format
 * paths meet here. Value transforms come from the registry's `ClaimCodec`; a
 * shrinking co-located BESPOKE builder table (below) holds the per-claim shapes
 * of the two claims the generic member-set walker cannot serve (`cnf`,
 * `events` — each for a stated, durable reason rather than a deferral: see
 * `internal/claims/cnf-members.ts` and {@link BespokeKind}), and the generic
 * structure walker beside it handles the ones it can
 * (`act`/`may_act`, `address`, `authorization_details`, `sub_id`). All
 * case/name conversion is Aegis-side: a registered claim
 * takes the explicit registry path (name + value transform); anything NOT in the
 * registry is a custom claim whose KEY case flips mechanically (snake on write,
 * camel on read) with its value untouched.
 *
 * Hash DERIVATION is NOT here (it needs the signing algorithm and stays in
 * `assemble-common-claims.ts`); the translator only maps the already-derived
 * `accessTokenHash` -> `at_hash`, so it is fully mechanical and algorithm-free.
 */

// The wire-name selector — the ONE parameter that separates the JOSE and COSE
// variants of both cores — now lives on the registry that owns the divergence,
// so the identity-matcher builder keys its predicate by the same rule.

// --- Value decoders (read side) ----------------------------------------------

const toDate = (value: unknown): Date | undefined => {
  if (value instanceof Date) return value;
  if (isFinite(value)) return new Date(value * 1000);
  return undefined;
};

const toStringArray = (value: unknown): Array<string> | undefined => {
  if (isArray(value)) return value as Array<string>;
  if (isString(value)) return value.split(" ").filter(Boolean);
  return undefined;
};

const toAudience = (value: unknown): Array<string> | undefined => {
  if (isArray(value)) return value as Array<string>;
  if (isString(value)) return [value];
  return undefined;
};

// --- The RFC 7800 confirmation, in both directions ---------------------------

/**
 * ⭐ BOTH DIRECTIONS ARE DRIVEN BY ONE DECLARATION — `internal/claims/cnf-members.ts`.
 * They used to be two hand-written literals here, and a member could be added to
 * one and not the other with nothing to notice: the write table spelled five
 * members out as an object literal, the read table spelled the same five out again
 * as a chain of ternaries.
 *
 * ⚠⚠ NEITHER SIDE ACCEPTS THE OTHER VOCABULARY'S SPELLING FOR A DECLARED MEMBER,
 * AND THAT IS A CONSUMER-VISIBLE BREAK. `toConfirmation` used to read
 * `v.thumbprint ?? v.jkt` at every member, PREFERRING the domain form — so a
 * token whose `cnf` carried `thumbprint` rather than RFC 9449's `jkt` was
 * honoured as if it were the registered member, and a presenter-supplied
 * look-alike could answer for an absent one. It is the same look-alike hazard the
 * top-level read closes by resolving a claim under its WIRE name alone
 * ({@link ClaimReadMode}), and the same tolerance the RFC 8693 actor chain shed
 * when it migrated. A misspelled member is REFUSED for the collision now — see
 * the unconditional reservation in {@link walkConfirmation}, and read that note
 * before weakening this one: an earlier version of this paragraph asserted the
 * property while the code only had it when BOTH names were present, which left
 * the single-name case writing a look-alike straight into the declared slot.
 *
 * ⚠⚠ A MEMBER WHOSE VALUE CONTRADICTS ITS DECLARED SHAPE IS REFUSED, NOT DROPPED,
 * ON BOTH SIDES. That is the ruling that closes a live fail-open, and it was
 * measured through the public doors before the change: a foreign token carrying
 * `cnf: { jkt: null }`, `cnf: { jkt: 42 }`, `cnf: { jkt: {} }` or a `cnf` that is
 * not an object at all had the offending member ERASED to `undefined` by the old
 * decoder, the whole confirmation then collapsed to `undefined`, and every one of
 * them VERIFIED AS A PLAIN BEARER TOKEN — an attacker who can blank one field
 * turns a sender-constrained token into one anybody holding a copy may present.
 * A binding the issuer STATED and this package cannot read is a binding that
 * cannot be honoured, and the only safe disposal of one is a refusal.
 *
 * ⚠ AN EMPTY CONFIRMATION IS REFUSED TOO — see {@link cnfBinding}. The registry
 * entry for `cnf` has always claimed "an empty one confirms no key and is
 * refused"; until now the write side collapsed it to `undefined` and MINTED A
 * BEARER TOKEN instead, so a caller that asked for a proof-of-possession binding
 * silently got none.
 */
const cnfValueMatches = (member: CnfMemberSpec, value: unknown): boolean =>
  member.value === "jwk" ? isObject(value) : isString(value);

/**
 * Translate the confirmation in ONE direction, driven by the member table.
 *
 * `lookup` resolves an INCOMING key to a declared member and `outKeyOf` spells
 * that member on the way out, which is the whole of the difference between the
 * two directions — the guards, the tail policy and the refusals are shared, so
 * they cannot be written differently twice.
 */
const walkConfirmation = (
  value: unknown,
  lookup: ReadonlyMap<string, CnfMemberSpec>,
  outKeyOf: (member: CnfMemberSpec) => string,
  context: WalkContext,
): Dict | undefined => {
  if (!isObject(value)) {
    context.invalid.push({
      key: context.path,
      message: `Claim "${context.claim}" must be an object`,
    });

    return undefined;
  }

  const out: Dict = {};

  /**
   * ⭐⭐ EVERY DECLARED MEMBER'S OUTGOING KEY IS RESERVED UNCONDITIONALLY —
   * whether or not that member is present. This is the whole of the collision
   * defence, and the UNCONDITIONAL part is the correction that matters.
   *
   * ⛔⛔ RESERVING ONLY WHAT ARRIVES LEAVES THE ATTACK FULLY OPEN, and it was
   * measured on the version that did. `walkObject`'s defence registers a key as a
   * VALUE claims it, so a tail key landing on a declared member's outgoing key is
   * refused only when the declared member is ALSO there. A `cnf` naming just ONE
   * of the pair has nothing to collide with, so the look-alike is written into the
   * declared member's own slot:
   *   - WRITE. `mint("access_token", { confirmation: { jkt: "abc" } })` — the
   *     caller spelling the WIRE name in a DOMAIN bag, which is the likely
   *     mistake rather than an exotic one, since `jkt` is what every RFC and every
   *     other library calls it — minted `cnf: { jkt: "abc" }` with the RFC 7638
   *     32-byte grammar never run, because the shape rule reads the DOMAIN name.
   *     `{ jkt: "" }` minted too, so aegis issued a token its own verifier then
   *     refused `confirmation_binds_no_key`.
   *   - READ. A foreign `cnf: { thumbprint: "abc" }` — a member RFC 7800 §3.1
   *     requires a reader to IGNORE — landed on `confirmation.thumbprint`, the
   *     exact slot `internal/utils/apply-verify-policy.ts` reads as the bound
   *     thumbprint, and drove the DPoP gate.
   * ⇒ A key a declared member OWNS is refused to the tail outright. The tail is
   * carried because §3.1 says an unknown member must be ignored; a member that is
   * not unknown but MISSPELLED is not that, and honouring it would let the caller
   * or the token's writer choose which vocabulary aegis reads the binding in.
   *
   * ⚠ IT ALSO SUBSUMES THE PRESENT-AND-PRESENT CASE, which is why there is no
   * second mechanism beside it. `{ jkt: JKT, thumbprint: "evil" }` on read used to
   * let the look-alike WIN — `toConfirmation` preferred the domain spelling, so it
   * returned `thumbprint: "evil"` and discarded the real `jkt` — and both orders
   * are refused now, by this one check, whichever arrives first.
   *
   * ⚠ A `Map` keyed by the OUTGOING name, holding the member's own INCOMING name,
   * so the refusal can say which two names met. Two declared members cannot
   * collide with each other (`cnf-members.test.ts` pins the five spellings apart)
   * and two tail keys cannot collide at all — they are keys of one object — so
   * tail-versus-declared is the only pair there is.
   */
  const declaredOutKeys = new Map<string, string>();
  for (const [incoming, member] of lookup) {
    declaredOutKeys.set(outKeyOf(member), incoming);
  }

  for (const [key, inner] of Object.entries(value)) {
    const member = lookup.get(key);

    // An undeclared member. RFC 7800 §3.1 requires a reader to IGNORE what it
    // does not understand, so it rides verbatim rather than being refused — and
    // verbatim rather than case-flipped, because a tail member is another
    // specification's registered confirmation-method name and §6.2.1 makes those
    // names case sensitive.
    if (member === undefined) {
      const owner = declaredOutKeys.get(key);

      if (owner !== undefined) {
        const [first, second] = [owner, key].sort();

        context.invalid.push({
          key: `${context.path}.${key}`,
          message: `Members "${first}" and "${second}" both resolve to "${key}" in "${context.path}"`,
        });
        continue;
      }

      // ⚠ `=== undefined`, not {@link isNotStated} — the tail takes the same `cnf`
      // exemption the declared members take, and for the same reason: RFC 7800 §6.2
      // lets another specification register a confirmation method, so a tail member
      // is somebody's confirmation method and not a spare attribute. Erasing a null
      // one would let a caller state a binding this package silently drops, which is
      // the fault the declared-member note below measures.
      if (inner === undefined) continue;

      Object.defineProperty(out, key, {
        value: inner,
        configurable: true,
        enumerable: true,
        writable: true,
      });
      continue;
    }

    // `undefined` is how absence is spelled throughout this package, so a member
    // a caller assembled from an optional it did not have is ABSENT rather than
    // malformed. Neither JSON nor CBOR can express it, so on the read side it can
    // only come from a caller's own dict at the vocabulary door.
    //
    // ⛔⛔ `null` IS **NOT** ABSENCE HERE, AND `cnf` IS THE ONE CLAIM EXEMPT FROM
    // THAT RULING. Everywhere else a null member is omitted ({@link isNotStated});
    // a confirmation member falls through to the refusal below instead, and the
    // exemption is load-bearing rather than conservative:
    //
    //   1. IT MINTED AN UNBOUND TOKEN. `domainToWire` erases a member before the
    //      COSE fail-closed guard ever runs, and that guard asks
    //      `cnf[member] !== undefined` (`internal/cose/cose-key.ts`) — so an
    //      already-erased `jkt` is not "unrepresentable on COSE", it is nothing at
    //      all. MEASURED with a control, on the carve-out build:
    //        `mint("cwt", { thumbprint: JKT,  keyId: KID })`  REFUSE
    //                                        `cose_cnf_unsupported {members:["jkt"]}`
    //        `mint("cwt", { thumbprint: null, keyId: KID })`  MINTED, and the token
    //                                        verified with NO PROOF
    //        `mint("cwt", { keyId: KID })`                    MINTED, BYTE-IDENTICAL
    //      The JOSE half is the same shape and no better: `{ jkt: JKT, keyId }`
    //      mints and then refuses `dpop_proof_required` at verify, while
    //      `{ jkt: null, keyId }` minted and verified ACCEPTED. A caller asking for
    //      a thumbprint binding received a token nobody is ever asked to prove
    //      possession for, indistinguishable from a legitimate key-id binding.
    //      `classes/confirmation-claim-wire.test.ts` documents that exact defect as
    //      FIXED; the carve-out reopened it through a different spelling.
    //   2. RFC 9449 §6.1 TYPES THE MEMBER, BY MUST — "The value of the jkt member
    //      MUST be the base64url encoding (as defined in [RFC7515]) of the JWK
    //      SHA-256 Thumbprint (according to [RFC7638]) of the DPoP public key (in
    //      JWK format) to which the access token is bound." So `jkt: null` is a
    //      value CONTRADICTING the declared shape, not a position left unfilled.
    //      ⚠ NOT RFC 7800 §3.1, which these notes cited for a while: that section
    //      defines the `cnf` container and names `jwk`/`jwe`/`jku`, and RFC 7800's
    //      one thumbprint mention is about a `kid` value. `cnf-members.ts` had the
    //      right citation throughout.
    //      The ordinary argument for the carve-out — a nullable database column is
    //      an unset optional — does not reach a claim whose whole content is a key
    //      the recipient must be able to confirm.
    //   3. "ERASED" AND "ABSENT" MUST NOT COLLAPSE ON THIS CLAIM. Every other
    //      structured claim reports a fact; `cnf` states a security property whose
    //      failure mode is exactly the two becoming indistinguishable — which is
    //      what §1 measures.
    // ⇒ A `cnf` member is judged by {@link cnfValueMatches} alone, and `undefined`
    //   is the only absence it recognises.
    if (inner === undefined) continue;

    if (!cnfValueMatches(member, inner)) {
      context.invalid.push({
        key: `${context.path}.${member.domain}`,
        message: `Member "${member.domain}" must be ${member.value === "jwk" ? "a JWK object" : "a string"}`,
      });
      continue;
    }

    out[outKeyOf(member)] = inner;
  }

  return out;
};

/**
 * THE VERDICT AN EMPTY CONFIRMATION GETS, asked at the emission side of the
 * translator so a caller hears it before anything is signed.
 *
 * RFC 7800 §3 — "By including a 'cnf' (confirmation) claim in a JWT, the issuer
 * of the JWT declares that the presenter possesses a particular key and that the
 * recipient can cryptographically confirm that the presenter has possession of
 * that key." A confirmation naming no key declares a possession nobody can
 * confirm, so neither disposal below it is a token anyone asked for: dropping it
 * hands the audience a BEARER token where the issuer asked for a bound one, and
 * emitting it puts a binding on the wire that every conformant verifier must
 * reject.
 *
 * ⚠ The same verdict is taken again at VERIFY (`internal/utils/apply-verify-policy.ts`),
 * on a token this package did not mint. One rule, two doors — not two rules.
 */
const cnfBinding = (cnf: Dict, context: WalkContext): Dict => {
  if (!isClaimSatisfied(cnf)) {
    context.invalid.push({
      key: context.path,
      message: `Claim "${context.claim}" names no key to confirm`,
    });
  }

  return cnf;
};

// -----------------------------------------------------------------------------

/**
 * The RFC 8417 SET `events` map, guarded in EITHER direction — ONE function,
 * because the two directions ask exactly one question of this claim and asking
 * it in two places is how they came to disagree before (the read arm was a bare
 * `return value` while the write arm guarded, so
 * `Aegis.toDomain({ events: "not-an-object" })` returned the string in a field
 * typed `Record<string, Dict>`).
 *
 * ⚠⚠ A NON-OBJECT IS REFUSED, NOT DROPPED — the same disposition {@link walkObject}
 * and {@link walkElements} state, reaching the one structured claim that has no
 * member set to walk. RFC 8417 §2.2 defines the claim as a map of event-type URIs
 * to payloads, so a scalar under that name is not a partial event map, it is not
 * one; and dropping it is invisible from both sides — a caller's events vanish
 * from a signed token with nothing said, and a stranger's token is reported as
 * carrying no events when it carries a value.
 *
 * ⚠ The KEYS are untouched, which is the whole reason this claim has its own arms:
 * an event-type URI is an identifier, and the house case flip would rewrite it.
 *
 * ⚠ NOTHING IS SAID ABOUT THE PAYLOADS, and that is correct rather than a gap.
 * §2.2 makes each payload's contents the event type's own business, so aegis has
 * no shape to hold one to.
 */
const eventsMap = (value: unknown, context: WalkContext): Dict | undefined => {
  if (isObject(value)) return value;

  context.invalid.push({
    key: context.path,
    message: `Claim "${context.claim}" must be an object`,
  });

  return undefined;
};

// Dispatch ONE `bespoke` claim's value to its per-claim JOSE builder, keyed by
// the registry codec's `bespoke` sub-kind. Every {@link BespokeKind} is
// enumerated here; an unhandled sub-kind (the `undefined` fall-through of a
// registry/translator drift) throws loudly (the house exhaustive-switch idiom).
const encodeBespoke = (
  spec: ClaimMemberSpec,
  bespoke: BespokeKind,
  value: unknown,
  context: WalkContext,
): unknown => {
  switch (bespoke) {
    case "confirmation": {
      const cnf = walkConfirmation(
        value,
        cnfMemberByDomain,
        (member) => member.wire.jose.name,
        context,
      );

      return cnf === undefined ? undefined : cnfBinding(cnf, context);
    }
    case "events":
      // ⚠ One guard for both directions — see {@link eventsMap}.
      return eventsMap(value, context);
    default: {
      const exhaustive: never = bespoke;
      throw new AegisDomainError("Unhandled bespoke claim sub-kind", {
        code: "translate_unhandled_bespoke_domain",
        data: { domain: spec.domain, bespoke: String(exhaustive) },
        title: "Unhandled Bespoke Claim Sub-Kind",
        details:
          "The claim registry declared a bespoke claim the translator has no builder for.",
      });
    }
  }
};

// --- The generic structure walker --------------------------------------------

/**
 * THE OPEN TAIL'S CASE FLIP, applied ONE KEY AT A TIME.
 *
 * It has to be per key because the walk below follows the VALUE's own key order
 * rather than the declaration order, so a declared and an undeclared member may
 * interleave — and the wire bytes are order-sensitive.
 *
 * ⚠ It is EXACTLY the blanket `snakeKeys(value)` / `camelKeys(value)` this
 * replaced, not an approximation of it: `@lindorm/case` walks an object entry by
 * entry and transforms each independently, so flipping a one-entry bag per key
 * and flipping the whole bag once produce the same keys at every depth. Flipping
 * only the TOP key — which is what an unregistered TOP-LEVEL claim gets — would
 * NOT: an undeclared member holding a nested object would keep its inner
 * spelling and the round trip would stop being symmetric.
 */
const flipOneKey = (
  key: string,
  value: unknown,
  flip: (dict: Dict) => Dict,
): [string, unknown] => {
  const entries = Object.entries(flip({ [key]: value }));

  return entries[0] as [string, unknown];
};

/**
 * WHERE A WALK IS, AND WHAT IT HAS FOUND — the two facts a refusal needs and
 * neither the codec nor the direction can supply.
 *
 * ⚠⚠ `claim` AND `path` ARE NOT THE SAME FACT ONE LEVEL APART, and collapsing
 * them was a real defect. `claim` is the TOP-LEVEL claim the walk was entered
 * for and never changes; `path` grows with every level descended. Deriving the
 * first from the second — or, as this file did, passing the member's own domain
 * as both — makes a violation at `act.act.subject` report `claim: "act"`,
 * `key: "act.subject"`: indistinguishable from depth 1, and identical for `act`
 * and `mayAct`, which share one member set. A refusal that cannot locate the
 * member it is about is a repair instruction nobody can follow.
 *
 * ⚠ ONE ACCUMULATOR PER CLAIM, not per structure. Every violation anywhere under
 * a claim — across a collection's elements AND across nesting depth — is
 * collected before anything is thrown, which is the stance
 * `internal/profiles/enforce-policy.ts` takes for a whole token.
 *
 * ⭐ `claim` IS READ BELOW DEPTH 1, AND EXACTLY ONE MEMBER MAKES IT SO. It is
 * read at the claim boundary (always the top context) and in ONE place a child
 * context can reach: the non-array message in {@link walkElements}, which needs a
 * MEMBER whose codec is `array` WITH `of`. RFC 9493 §3.2.8's `sub_id.identifiers`
 * is that member — "a JSON array containing one or more Subject Identifiers" —
 * so `subjectId: { format: "aliases", identifiers: "not-an-array" }` reports
 * `Claim "subjectId" must be an array` at key `subjectId.identifiers`.
 * ⚠ THIS WAS AN EQUIVALENT MUTANT UNTIL THAT MEMBER ARRIVED: a `childPath` that
 * overwrote `claim` with the member's own domain would have said
 * `Claim "identifiers" must be an array` with nothing to notice it, because no
 * declared member reached the collection arm at depth. `act`'s `audience` is an
 * array with NO `of`. The pin lives in `classes/sub-id-claim-wire.test.ts`.
 */
type WalkContext = {
  /** The claim the walk was entered for. Constant for the whole descent. */
  claim: string;
  /** Where the walk is inside that claim: `act.act`, `authorizationDetails[0]`. */
  path: string;
  /** Every violation found under this claim so far. */
  invalid: Array<InvalidEntry>;
};

/** Descend one named step — the ONLY place a path grows. */
const childPath = (context: WalkContext, step: string): WalkContext => ({
  claim: context.claim,
  path: `${context.path}.${step}`,
  invalid: context.invalid,
});

/** Descend into one element of a collection. */
const elementPath = (context: WalkContext, index: number): WalkContext => ({
  claim: context.claim,
  path: `${context.path}[${index}]`,
  invalid: context.invalid,
});

/**
 * The half of a structure walk that DIFFERS between writing and reading, named
 * so that a direction-dependent rule cannot be smuggled into the shared walk as
 * a symmetric one. That is not hypothetical: `whenEmpty` was applied in both
 * directions here, and being symmetric BY CONSTRUCTION is exactly why nothing
 * announced it.
 */
type WalkDirection = {
  /** Which key the INCOMING bag spells a member by. */
  keyOf: (member: ClaimMemberSpec) => string;
  /** Which key the OUTGOING bag spells it by. */
  outKeyOf: (member: ClaimMemberSpec) => string;
  /** How one member's value crosses, at the member's own place in the claim. */
  translate: (member: ClaimMemberSpec, inner: unknown, context: WalkContext) => unknown;
  /**
   * The mechanical key case flip an UNDECLARED member takes on this side —
   * applied only where the structure declares `open: "flip"`. An
   * `open: "verbatim"` tail never reaches it.
   */
  flip: (dict: Dict) => Dict;
  /**
   * Whether {@link ClaimMemberSpec.whenEmpty} applies on this side. TRUE on the
   * write side ALONE.
   *
   * ⚠ IT IS NOT AN OPTIMISATION AND NOT A SYMMETRY. `ParamSpec.whenEmpty` is a
   * verdict about what AEGIS EMITS: a read reports what a PRODUCER wrote, and
   * rewriting a foreign token's empty member into an absence would make aegis
   * misreport a stranger's token — claiming an issuer said nothing where the
   * issuer said "empty". The top-level column has always been write-side-only
   * (`internal/claims/prune-empty-claims.ts` runs on emission and nowhere else);
   * this is the same rule, one level in, and it has to be stated because a
   * single shared walk would otherwise apply it to both sides for free.
   */
  prunesEmpty: boolean;
};

/**
 * Walk a DECLARED structure in ONE direction, driven by the registry's member
 * set — the generic replacement for the per-claim builders that used to write a
 * structure's shape out by hand.
 *
 * ⭐ IT WALKS THE VALUE, NOT THE MEMBER LIST, and that is load-bearing rather
 * than incidental. JSON preserves insertion order, so the JOSE bytes of a
 * structured claim are decided by the order its members were written in; walking
 * the declaration instead would re-order every caller's address and move bytes
 * on a signed wire while every round trip still passed. It is the same
 * discipline `prune-empty-claims.ts` states for the top-level bag, one level in.
 * (The COSE side is indifferent — CBOR deterministic encoding sorts the keys —
 * so JOSE is where the rule is observable and where it must hold.)
 *
 * ⚠ A member is resolved through a `Map`, never through `in` on the incoming
 * bag. The keys come from a stranger's payload on the read side, and `in` walks
 * `Object.prototype` — so `constructor` or `toString` would resolve as a member
 * name. A `Map` cannot be reached that way at all.
 *
 * ⚠⚠ A NON-OBJECT VALUE IS REFUSED, NOT DROPPED — the ruling that makes every
 * declared structure answer the same way. It used to yield `undefined`, so the
 * claim simply did not resolve, and that left ONE fault class with THREE
 * dispositions across the registry: `address` dropped a non-object in silence,
 * `authorizationDetails` refused a non-array ({@link walkElements}), and `cnf`
 * refused a non-object ({@link walkConfirmation}). A drop is invisible from both
 * sides — a caller's claim vanishes from a signed token with nothing said, and a
 * stranger's token is reported as saying less than it says — which is the same
 * argument the closed-set branch below already made about an undeclared member.
 * A reader that silently discards a claim reports a token that made no statement
 * where its issuer signed one.
 *
 * ⚠ `null` NEVER REACHES THIS GUARD, and each of the three entry points is why:
 * a CLAIM's value is classified at the read/write core, a MEMBER's at the loop
 * below, and an ELEMENT's by {@link walkElements}'s own `isObject` — which is a
 * DIFFERENT rule, because an array slot is positional and cannot be left
 * unfilled. The first two are one predicate, {@link isNotStated}, and it is the
 * one place that boundary is decided.
 *
 * ⚠ THE MESSAGE NAMES THE CLAIM AND THE `key` NAMES THE POSITION, so a member
 * whose own codec is a structure reports `Claim "act" must be an object` at key
 * `act.act`. That is deliberate and matches {@link walkElements}: the CLAIM is
 * what a caller repairs and what `data.claim` carries at every depth, while the
 * path is what says which part of it.
 *
 * ⚠ IT REPORTS A {@link ClaimMemberSpec.required} VIOLATION, IT DOES NOT THROW
 * ON ONE. The throw belongs at the CLAIM boundary ({@link encodeClaim} /
 * {@link decodeClaim}), because that is the only level at which "everything
 * wrong with this claim" is a complete answer — across a collection's elements
 * and across nesting depth alike.
 */
const walkObject = (
  codec: ObjectCodec,
  value: unknown,
  direction: WalkDirection,
  context: WalkContext,
): Dict | undefined => {
  if (!isObject(value)) {
    context.invalid.push({
      key: context.path,
      message: `Claim "${context.claim}" must be an object`,
    });

    return undefined;
  }

  const members = new Map(
    codec.children().map((member) => [direction.keyOf(member), member]),
  );
  const out: Dict = {};

  /**
   * ⭐⭐ EVERY DECLARED MEMBER'S OUTGOING KEY, RESERVED UNCONDITIONALLY — built
   * from the DECLARATION before the walk begins, so it does not matter whether
   * the member the key belongs to is present, valid, or absent entirely.
   *
   * ⚠⚠ THE HAZARD IS SPECIFIC AND IT WAS MEASURED, on the real `address`
   * declaration, through the public vocabulary door:
   * `Aegis.toDomain({ address: { street_address: "DECLARED", streetAddress: "SHADOW" } })`
   * yielded `{ streetAddress: "SHADOW" }` — the declared member resolved to the
   * domain key, the open tail flipped onto the SAME key, and the last one in
   * `Object.entries` order won. An OPEN `act` has exactly that shape one level in
   * (`{ sub: "audited-service", subject: "rogue-service" }` — `sub` resolves to
   * `subject`, and a verbatim tail `subject` lands on `subject`), which hands
   * ACTOR IDENTIFICATION to whoever wrote the token, silently, by key order.
   *
   * ⛔⛔ RESERVING ONLY WHAT ARRIVES LEAVES THE ATTACK FULLY OPEN, and TWO
   * successive versions of this guard did exactly that.
   *   - The FIRST registered the key inside the write, after translation and
   *     after the emptiness prune, so a declared member whose value FAILED ITS
   *     OWN CODEC vacated its slot in silence. Measured then:
   *     `Aegis.toWire({ act: { subject: 42, sub: "shadow" } })` ->
   *     `{ act: { sub: "shadow" } }`, and `Aegis.toDomain({ act: { sub: 42,
   *     subject: "rogue-service" } })` -> `{ act: { subject: "rogue-service" } }`
   *     — the read side, so entirely in the hands of whoever wrote the token:
   *     make the ISSUER'S member invalid and the look-alike is believed.
   *   - The SECOND took the reservation from the KEY rather than the value, which
   *     closed that — and still only for a member that ARRIVED. A structure naming
   *     just ONE of the pair has nothing to collide with, so the look-alike took
   *     the declared slot uncontested. Measured on that version:
   *     `Aegis.toDomain({ act: { subject: "rogue" } })` -> `{ act: { subject:
   *     "rogue" } }` with no refusal — BYTE-IDENTICAL to what a genuine
   *     `act: {"sub":"rogue"}` produces, so a consumer reading `claims.act.subject`
   *     for an allowlist or an audit record cannot tell the two apart. The same on
   *     `sub_id` (`{ format, subject }`), on `address` (`{ streetAddress }`), and
   *     on the WRITE side: `Aegis.toWire({ act: { sub: "shadow" } })` put a value
   *     onto a signed wire with NO codec guard at all, because the guard belongs to
   *     the declared member whose slot it was stealing.
   * ⇒ The reservation is taken from `codec.children()`, once, before any key of
   * the incoming value is looked at.
   *
   * ⚠⚠ THIS DOES NOT NARROW THE OPEN TAIL, AND THE DISTINCTION IS THE RULING.
   * RFC 8693 §4.1 and RFC 7800 §3.1 both say an unknown member is carried or
   * ignored — and neither says a member may be written INTO ANOTHER MEMBER'S OWN
   * SLOT, which is what makes the look-alike indistinguishable downstream. So a
   * tail key that does NOT collide is still carried, exactly as before; a tail key
   * that DOES is refused. Carrying an unknown member and carrying it into a
   * declared member's domain slot are two different acts.
   *
   * ⚠ A `Map` and not `Object.hasOwn` on `out`, because a member legitimately
   * named `constructor` or `toString` would resolve through `Object.prototype`
   * and be reported as a collision that never happened.
   */
  const declaredOutKeys = new Map<string, string>();
  for (const member of codec.children()) {
    declaredOutKeys.set(direction.outKeyOf(member), direction.keyOf(member));
  }

  /**
   * The outgoing keys a TAIL member has taken — a SECOND map, because the two
   * answer different questions and only one of them can be built ahead of time.
   *
   * ⚠ IT EXISTS FOR `open: "flip"` ALONE, and that is why it survives the
   * unconditional reservation above. Two DISTINCT undeclared keys can flip onto
   * one key (`foo_bar` and `fooBar` both camelise to `fooBar`), so a tail can
   * collide with another tail — which no declaration can predict. A
   * `"verbatim"` tail cannot: its outgoing key IS its incoming key, and an object
   * has each key once.
   *
   * ⚠ THE DECLARED MEMBERS NO LONGER REGISTER HERE. Their keys are reserved by
   * construction above, and a tail that would land on one is refused before it
   * reaches this map — so a declared member's own write can no longer be refused
   * by a key some other member took, because no other member can take it.
   */
  const claimedByTail = new Map<string, string>();

  /**
   * The members whose WRITTEN value did not survive its own codec — the one fact
   * the mandatory-member check below cannot recover afterwards.
   *
   * ⚠ `out` CANNOT STAND IN FOR IT. Three different faults leave a member missing
   * from `out` — it was absent, it was pruned as empty (`whenEmpty: "prune"`), or
   * its value failed its codec — and only the third is a shape problem. A guard
   * built on `Object.hasOwn(out, …)` reports the pruned case as a shape fault,
   * which is how a row pinning an EMPTY `type` went red the first time this was
   * attempted.
   */
  const codecRejected = new Set<string>();

  /**
   * Report two names meeting on one outgoing key.
   *
   * ⚠ THE TWO NAMES ARE SORTED, AND THAT IS NOT COSMETIC. Which one arrives
   * second is decided by the bag's key order, and the two wires do not agree
   * about it: a JSON payload preserves the caller's insertion order while a CBOR
   * map is deterministically sorted, so the same collision reported "second name
   * first" reads differently on each encoding. Neither member is the offender —
   * the PAIR is — so the message names them in a stable order and one rule keeps
   * one spelling on both wires.
   */
  const reportCollision = (outKey: string, first: string, second: string): void => {
    const [a, b] = [first, second].sort();

    context.invalid.push({
      key: `${context.path}.${outKey}`,
      message: `Members "${a}" and "${b}" both resolve to "${outKey}" in "${context.path}"`,
    });
  };

  /** Reserve one outgoing key FOR A TAIL MEMBER. `false` when it is spoken for. */
  const claimForTail = (outKey: string, incoming: string): boolean => {
    const owner = declaredOutKeys.get(outKey) ?? claimedByTail.get(outKey);

    if (owner !== undefined) {
      reportCollision(outKey, owner, incoming);
      return false;
    }

    claimedByTail.set(outKey, incoming);
    return true;
  };

  /**
   * `Object.defineProperty` rather than `out[key] = value`.
   *
   * ⚠⚠ NO MEMBER KEY DISTINGUISHES THE TWO FORMS TODAY. `__proto__` is the only
   * accessor on `Object.prototype` — plain assignment carries `toString`,
   * `constructor` and `valueOf` as own data properties just as this does — and a
   * claim carrying `__proto__` is refused upstream ({@link protoMemberViolations},
   * asked once per claim in {@link claimContext}). Replacing this with an
   * assignment therefore leaves the suite green, correctly.
   *
   * ⭐ IT IS KEPT BECAUSE IT IS A MECHANISM AND THE REFUSAL IS A POLICY. It holds
   * whatever the policy says, and it is what keeps `out` clean while an
   * ALREADY-DOOMED walk runs to completion: the refusal is accumulated, not
   * thrown, so a hostile `__proto__` reaches the open tail below and is written
   * here before the boundary discards the whole result.
   *
   * ⛔ DELETING THE REFUSAL DOES NOT MAKE THIS THE LAST LINE OF DEFENCE — nor is
   * pollution what follows. Downstream `__proto__` reaches `omitFromObject`, which
   * also writes with `Object.defineProperty` (`omit-from-object.ts:32`), so the own
   * key is preserved and nothing is polluted (measured through the built package).
   * The rebuilds that DID swap a prototype are closed by the same mechanism —
   * `prune-empty-claims.ts` and this file's own custom bag (built here, rebuilt in
   * `wireToFloorClaims`). ⛔ NOT the COSE claims decode: aegis rebuilds nothing
   * there and the disposal is entirely `@lindorm/cbor`'s
   * (`internal/cose/cwt-claims.ts` states the measurement). See
   * `proto-member-violations.ts`, where the refusal's justification is filed for
   * removal.
   */
  const emit = (outKey: string, outValue: unknown): void => {
    Object.defineProperty(out, outKey, {
      value: outValue,
      configurable: true,
      enumerable: true,
      writable: true,
    });
  };

  // ⛔⛔ `__proto__` IS NOT REFUSED HERE, AND THAT IS A CORRECTION RATHER THAN A
  // RELAXATION. This loop used to carry the refusal, and it refused the member
  // names it walked PAST — which is strictly less than the member names a claim
  // CARRIES. Measured at `aegis.parse` on forged tokens: an `open: "verbatim"`
  // tail's nested value is emitted untouched and never descended, so
  // `sub_id: {"format":"opaque","tail":{"__proto__":{"pwn":"yes"}}}` produced
  // `{"format":"opaque","tail":{}}` with `subjectId.tail.pwn` reading `"yes"` —
  // on a claim that had already migrated onto this walker. A `bool` claim
  // (`email_verified`) did the same with no structure involved at all.
  // ⇒ The rule is a CLAIM-level one and is asked once per claim, of the whole
  // value, in {@link claimContext} — see `internal/claims/proto-member-violations.ts`.
  for (const [key, inner] of Object.entries(value)) {
    const member = members.get(key);

    if (member === undefined) {
      // An undeclared member. `open` is what says it survives at all — and, when
      // it does, WHOSE vocabulary its key is in.
      //
      // ⚠⚠ A CLOSED SET REFUSES IT; IT DOES NOT DROP IT. Dropping is invisible
      // from both sides — a caller's member vanishes from a signed token with
      // nothing said, and a stranger's token is reported as saying less than it
      // says — so a closed set that dropped would be a weaker answer than the
      // structural rule it replaces rather than a substitute for it. The entry
      // carries the member's own spelling and the FULL PATH it sits at, because
      // at depth the leaf name alone ("surprise") does not say which actor in a
      // chain carried it.
      //
      // ⛔⛔ NO REGISTERED CLAIM IS CLOSED TODAY, AND THE LAST CANDIDATE IS RULED
      // OUT BY ITS OWN SPECIFICATION. `act`/`mayAct` were closed for one step and
      // RFC 8693 §4.1/§4.4 describe an open set, so they were opened. `cnf` was
      // the remaining prospect — and RFC 7800 §3.1 reverses it outright: "Other
      // members of the 'cnf' object may be defined", and "in the absence of such
      // requirements, all confirmation members that are not understood by
      // implementations MUST be ignored", with §6.2 establishing an IANA registry
      // other specifications register into. Refusing an undeclared confirmation
      // member would violate that MUST, so `cnf` carries a verbatim tail like the
      // actor chain does.
      // ⇒ THE BRANCH IS KEPT AND THE CELL IS REQUIRED INSTEAD. The hazard was
      // never this arm's lack of a user; it was that `open?:` let a structure
      // reach it BY OMISSION, at any depth, with nothing said — which is exactly
      // how the nested `act` member shipped closed while `act` itself was open.
      // {@link ObjectCodec.open} is now a required three-way cell, so a new
      // structure has to answer, and `"closed"` is what a structure says when its
      // specification enumerates its members and forbids the rest. Nothing in the
      // registry says it today; `translate.test.ts` is what keeps the arm live.
      if (codec.open === "closed") {
        context.invalid.push({
          key: `${context.path}.${key}`,
          message: `Member "${key}" is not declared in "${context.path}"`,
        });
        continue;
      }

      // ⚠ THE KEY IS FLIPPED FROM A PLACEHOLDER SO THE CLAIM DOES NOT DEPEND ON
      // THE VALUE. `flipOneKey` returns the flipped key AND the flipped value, and
      // the value half is load-bearing (an undeclared member holding a nested
      // object has its inner keys flipped too) — but an `undefined` value must
      // still reserve the key, and a case conversion of `{ key: undefined }` is
      // not a shape this walker should depend on. A `"verbatim"` tail is its own
      // outgoing key and needs no flip.
      const outKey =
        codec.open === "verbatim" ? key : flipOneKey(key, null, direction.flip)[0];

      if (!claimForTail(outKey, key)) continue;

      // ⚠ THE KEY IS RESERVED FIRST AND THE ABSENCE IS ASKED AFTER, deliberately.
      // Two DISTINCT undeclared keys can flip onto one outgoing key, and a tail
      // member that states nothing still occupies its own incoming name — so
      // `{ foo_bar: null, fooBar: "x" }` is still the collision it always was.
      // ⚠ `null` is NOT STATED here exactly as it is on a declared member: an
      // undeclared address member is a lindorm extension of a lindorm type, and a
      // caller's database row carries its nulls into the tail as readily as into
      // the six OIDC members. See {@link isNotStated}.
      if (isNotStated(inner)) continue;

      if (codec.open === "verbatim") {
        emit(outKey, inner);
        continue;
      }

      const [, carried] = flipOneKey(key, inner, direction.flip);
      emit(outKey, carried);
      continue;
    }

    // ⭐ NO RESERVATION IS TAKEN HERE. A declared member's outgoing key is
    // reserved from the DECLARATION before this loop starts, so it cannot have
    // been taken by anything — see `declaredOutKeys` above for the two versions
    // that took it later and what each one let through.
    //
    // ⚠⚠ `null` IS NOT STATED, SO IT IS OMITTED RATHER THAN REFUSED, and this is
    // the line that keeps the two rulings from colliding. `AegisProfileAddress`
    // declares every member `string | null`, so a caller minting from a database
    // row hands nulls straight in; the structure refusal above would otherwise
    // turn the ordinary shape of a nullable column into a thrown error. It is
    // asked here rather than inside the codec because the codec's answer is
    // "contradicts", and absence is not a contradiction. See {@link isNotStated}.
    if (isNotStated(inner)) continue;

    const translated = direction.translate(
      member,
      inner,
      childPath(context, member.domain),
    );
    /**
     * ⚠⚠ A MEMBER WHOSE VALUE FAILS A **LEAF** CODEC IS STILL DROPPED HERE, AND
     * SILENTLY — the RESIDUE of the refusal ruling, stated rather than implied.
     *
     * The ruling is that a value contradicting a DECLARED STRUCTURE is refused,
     * and it is held one level up from this line: a member whose codec is
     * `{ kind: "object" }` or `{ kind: "array", of }` reaches {@link walkObject}
     * or {@link walkElements}, and each pushes its own entry at the member's own
     * path before returning `undefined`. So `act: { act: 42 }` is REFUSED, at
     * every depth, and so is a member of a member.
     *
     * What is left is a LEAF codec — `text`, `int`, `date`, `bool`, `bstr`, an
     * array of strings — which has no walker to speak for it. Measured through the
     * public vocabulary door: `Aegis.toWire({ act: { subject: 42 } })` yields
     * `{ act: {} }` with nothing said, and the read side does the same for a
     * foreign token.
     *
     * ⚠⚠ THE LEAF GAP IS NOT THE SAME AT EVERY DEPTH, and an earlier version of
     * this note claimed it was. It is the same on the READ side —
     * `Aegis.toDomain({ sub: 42 })` reports no subject, exactly as the member does
     * — and it is NOT on the WRITE side: `Aegis.toWire({ subject: 42 })` yields
     * `{"sub":42}`, CARRIED, because `domainToWire` runs no derived-decoder probe
     * and the top level has no walker either. So a top-level leaf claim reaches a
     * signed wire with no codec guard at all, while the member one level in is
     * guarded by {@link encodeMember}. Closing it changes what EVERY registered
     * claim writes and reports — each claim needs its own disposition for a value
     * of the wrong shape — so it needs its own corpus gate and is deliberately
     * not done here.
     *
     * ⚠ `null` NEVER REACHES THIS LINE. It is classified as absence above and is
     * neither dropped-as-malformed nor refused — see {@link isNotStated}.
     *
     * ⚠ THE DROP IS RECORDED even though it is not refused, so the mandatory-member
     * check below can tell "you wrote a value of the wrong shape" from "you wrote
     * nothing". Nothing else reads it.
     */
    if (translated === undefined) {
      codecRejected.add(member.domain);
      continue;
    }

    // The member's OWN emptiness verdict, asked one level in — on the WRITE side
    // only. A `"keep"` member states its empty form (the issuer wrote it); a
    // `"prune"` member's empty form is indistinguishable from having said
    // nothing. See {@link WalkDirection.prunesEmpty} for why a read must not ask.
    if (direction.prunesEmpty && member.whenEmpty === "prune") {
      if (!isClaimSatisfied(translated)) continue;
    }

    emit(direction.outKeyOf(member), translated);
  }

  // The MANDATORY members, asked AFTER the walk so the question is about what
  // the structure ends up saying rather than about what the caller happened to
  // hand over. It reads the member's DOMAIN name in both directions — that is
  // the vocabulary aegis's errors speak — while `out` is keyed by the outgoing
  // spelling, which is why the value is looked up through `outKeyOf`.
  //
  // ⚠ `out[...]` IS A BARE READ, and it is the one in this file — which documents
  // the `Map`-over-`in` choice everywhere else — so which side of the line it is
  // on has to be said rather than left to a reader. It is SAFE, and not by luck:
  // the key comes from `codec.children()`, a CLOSED registry list, never from a
  // caller or a producer, so no prototype name can be reached unless the registry
  // itself declares a member called `toString`. The hazard the house rule guards
  // is a caller-influenced key, and this is not one. ⛔ It stops being safe the
  // day a member set is built from anything a token can influence; at that point
  // this needs `Object.hasOwn`, like every other lookup here.
  for (const member of codec.children()) {
    if (member.required === undefined) continue;
    if (isClaimSatisfied(out[direction.outKeyOf(member)])) continue;

    // ⚠ THE MESSAGE NAMES WHAT IS WRONG WHEN THE TWO FAULTS DIFFER, and only then.
    // `isClaimSatisfied` is false in three situations and they are not one repair:
    // the member is ABSENT, the member is present and EMPTY, or the member was
    // WRITTEN and its value did not survive its own codec. The third used to be
    // told "is required and must not be empty" — so a caller who wrote
    // `authorizationDetails: [{ type: 42 }]` was sent looking for a field they had
    // already written.
    //
    // ⚠ THE DISCRIMINATOR IS RECORDED AT THE DROP, not reconstructed here — see
    // `codecRejected` above for why `out` cannot tell the three apart.
    // ⚠ The first two keep the original wording deliberately: they are the common
    // case, several scenario rows pin the string, and "must not be empty" is the
    // right instruction for both.
    context.invalid.push({
      key: `${context.path}.${member.domain}`,
      message: codecRejected.has(member.domain)
        ? `Member "${member.domain}" is required and must be the shape it declares`
        : `Member "${member.domain}" is required and must not be empty`,
    });
  }

  return out;
};

/**
 * THE ONE REFUSAL A DECLARED STRUCTURE RAISES ABOUT A CALLER'S OR A PRODUCER'S
 * DATA — as opposed to the drift refusals around it, which are about the
 * REGISTRY disagreeing with the translator.
 *
 * ⚠⚠ IT RUNS IN BOTH DIRECTIONS AND UNDER EVERY PROFILE, INCLUDING NONE, and
 * that is a deliberate widening of where structural validation happens. The
 * fact it enforces used to be a profile `shape` rule
 * (`everyElementHasKey(claims, "authorizationDetails", "type")`), bound by
 * exactly ONE profile — `access_token` — so a token minted under any other
 * profile, or through the profile-less vocabulary door, carried an untypeable
 * authorization detail with nothing said about it. A structure's mandatory
 * member is a SHAPE fact: it holds wherever the structure does, and a rule a
 * profile can decline to declare is not that.
 *
 * ⚠ `AegisDomainError` carrying an `invalid` list, deliberately: it is the shape
 * a consumer already branches on for a policy refusal, and the entries carry the
 * same `{ key, message }` those do. The KEY locates the failure inside the claim
 * — `authorizationDetails[0].type`, `act.act.subject` — because a bare claim
 * name can say neither WHICH element of a collection nor WHICH DEPTH of a
 * recursive structure the bad member sits at.
 *
 * ⚠ FIVE FAILURES REACH IT, not one. `details` names all five because a consumer
 * reads it to know what to repair: a MANDATORY MEMBER that is absent or empty,
 * TWO MEMBERS THAT RESOLVE TO ONE KEY, a member the structure's CLOSED member set
 * does not declare, a claim value that is not the COLLECTION its codec declares,
 * and an ELEMENT of that collection that is not a structure. They share one code
 * because they share one repair — the claim's shape — and each entry's own
 * `message` says which of the five it is.
 */
const refuseInvalidStructure = (claim: string, invalid: Array<InvalidEntry>): never => {
  throw new AegisDomainError("Invalid claim structure", {
    code: "claim_structure_invalid",
    data: { claim, invalid },
    debug: { claim, invalid },
    title: "Invalid Claim Structure",
    details:
      "A claim does not have the structure the registry declares for it: a member its specification makes mandatory is absent or empty, two members resolve to the same key so neither can be honoured, a member is not one the claim's closed member set declares, the value is not the collection the claim is defined as, or an element of that collection is not a structure. Each entry in `invalid` names the offending position and what is wrong with it.",
  });
};

/**
 * The WRITE side's walk rules, built once per call and shared by the structure
 * and the collection arms.
 *
 * ⚠ NAMED RATHER THAN INLINED AT EACH ARM. A structure and a collection of
 * structures cross in the same direction, so a rule written twice is a rule that
 * can be written differently twice — and the one that differs between the sides
 * (`prunesEmpty`) is exactly the one a reader would not notice drifting.
 */
const writeDirection = (nameOf: NameSelector): WalkDirection => ({
  keyOf: (member) => member.domain,
  outKeyOf: nameOf,
  translate: (member, inner, context) => encodeMember(member, inner, nameOf, context),
  flip: snakeKeys,
  prunesEmpty: true,
});

/** The READ side's walk rules — the mirror, keyed by wire name. */
const readDirection = (nameOf: NameSelector): WalkDirection => ({
  keyOf: nameOf,
  outKeyOf: (member) => member.domain,
  translate: (member, inner, context) => decodeValue(member, inner, nameOf, context),
  flip: camelKeys,
  // A read reports what the PRODUCER wrote — see `WalkDirection`.
  prunesEmpty: false,
});

/**
 * Translate ONE array-of-structures value, in either direction.
 *
 * ⚠ EVERY ELEMENT IS WALKED BEFORE ANYTHING IS REPORTED, and every violation
 * goes into the CLAIM's accumulator. The deleted profile rule pushed one entry
 * per bad element and let the enforcer report them together; stopping at the
 * first would report one reason where the caller has two to fix.
 *
 * ⚠⚠ A NON-ARRAY VALUE, AND A NON-OBJECT ELEMENT, ARE BOTH REPORTED AS
 * VIOLATIONS — which is NOT what the sibling `array` arm does. `decodeArray`'s
 * `strict` policy DROPS a scalar (returns `undefined`), and that is right for an
 * array of strings: `ArrayScalar` answers a tolerance question about a scalar
 * standing in for an array, and a dropped `amr` is a claim the token is read as
 * not stating. It cannot be right here, because no scalar can stand in for a
 * structure at all — a value that is not a collection of structures is not a
 * partial `authorization_details`, it is not one. Dropping it would also lose
 * the two refusals the deleted profile rule made.
 */
const walkElements = (
  of: ObjectCodec,
  value: unknown,
  direction: WalkDirection,
  context: WalkContext,
): unknown => {
  if (!isArray(value)) {
    context.invalid.push({
      key: context.path,
      message: `Claim "${context.claim}" must be an array`,
    });

    return undefined;
  }

  return value.map((element, index) => {
    const at = elementPath(context, index);

    // ⚠ THE ELEMENT'S OWN SHAPE IS JUDGED HERE, NOT INSIDE {@link walkObject},
    // and the guard has to sit on this side to keep ONE entry per fault. Since
    // the walker began REFUSING a non-object rather than returning `undefined`
    // for one, letting a bad element fall into it produced TWO entries at one
    // path — the walker's `Claim "…" must be an object` and this one — which
    // reports a caller two faults where there is one, and would satisfy a row
    // pinning either message alone.
    // ⚠ This message is the one kept because it is the more precise of the two:
    // it names the INDEX, and "element 0 of a collection is not a structure" is a
    // different repair from "this claim is not a structure".
    // ⚠⚠ AN ELEMENT IS POSITIONAL, SO `null` IS **NOT** ABSENCE HERE — the one
    // place in this file where it is not. A member is named and can go unnamed;
    // an array slot cannot be left unfilled without changing every later index,
    // so `[null]` is a caller stating a first element that is not a structure,
    // and RFC 9396 §2 has no reading under which that is one.
    if (isObject(element)) return walkObject(of, element, direction, at);

    context.invalid.push({
      key: at.path,
      message: `Element "${at.path}" must be an object`,
    });

    return undefined;
  });
};

/**
 * THE CLAIM BOUNDARY — where a walk's context is created and where the ONE
 * refusal for that claim is raised.
 *
 * ⭐ THE THROW IS HERE AND NOWHERE INSIDE. A structure walk only accumulates, so
 * the report a caller gets is "everything wrong with this claim" rather than
 * "the first thing wrong with some part of it" — across a collection's elements
 * and across nesting depth alike. It is also what makes `data.claim` the CLAIM's
 * name at every depth: the level that names it is the level that entered.
 *
 * ⚠ THAT COMPLETENESS STOPS AT THE CLAIM, AND A TOKEN CAN BE WRONG IN TWO
 * PLACES AT ONCE. `internal/utils/mint-token.ts` enforces the profile policy
 * BEFORE any wire assembly, so a token failing both a policy rule and a
 * structure reports only the POLICY half and this refusal never runs. Measured
 * on a `mint("access_token", …)` missing `clientId` AND carrying an untyped
 * authorization detail: `invalid: [clientId]` alone, where the profile shape
 * rule this replaced reported `[clientId, authorizationDetails[0]]` in one
 * error. Both attempts still REFUSE, so it costs a caller a second round trip
 * rather than a wrong token — but it cuts against the stance above and is
 * recorded rather than left for someone to hit. Fixing it means the structural
 * walk running before, or alongside, policy enforcement; that is an ordering
 * change across the whole mint pipeline and is filed, not smuggled in here.
 *
 * ⭐⭐ THE ACCUMULATOR DOES NOT START EMPTY. Every claim value is scanned for
 * `__proto__` before its codec runs at all, and the findings SEED the list rather
 * than pre-empting it — so a claim that is both hostile and malformed still
 * reports both, and the `__proto__` entries come first in a stable order.
 *
 * ⚠ IT IS ASKED OF EVERY CLAIM, NOT OF EVERY STRUCTURE, and that is what the
 * measurement forced: the hazard is created by the read side's
 * `omitUndefined(claims)` rebuild, which asks nothing about a claim's codec. A
 * `bool` claim and a `bespoke` passthrough were both live. See
 * {@link protoMemberViolations} for the mechanism and the measurements.
 */
const claimContext = (spec: ClaimMemberSpec, value: unknown): WalkContext => ({
  claim: spec.domain,
  path: spec.domain,
  invalid: protoMemberViolations(value, spec.domain),
});

const refuseIfInvalid = <T>(context: WalkContext, value: T): T => {
  if (context.invalid.length > 0) refuseInvalidStructure(context.claim, context.invalid);

  return value;
};

/**
 * Encode ONE claim from its domain form, refusing a structure it cannot state.
 *
 * ⚠ EXPORTED FOR THE STRUCTURE WALKER'S DRIFT GUARD ALONE, exactly as
 * `internal/cose/cwt-spec.ts` exports its three shapers. No production caller
 * reaches it from outside this file.
 *
 * The guard it exists for cannot be written any other way: the walker's
 * direction-dependent rules — `whenEmpty` applying on the write side and NOT on
 * the read side — are unobservable through the public doors while every declared
 * member is `whenEmpty: "keep"`, and the registry has no `"prune"` member to
 * lend a test. A synthetic {@link ClaimMemberSpec} handed to the REAL boundary is
 * what exercises the real path with the one cell the registry does not yet have.
 * ⭐ The BOUNDARY is exported rather than the recursion beneath it, so the guard
 * runs the same entry point production does, context creation and refusal
 * included.
 */
export const encodeClaim = (
  spec: ClaimMemberSpec,
  value: unknown,
  nameOf: NameSelector,
): unknown => {
  const context = claimContext(spec, value);

  return refuseIfInvalid(context, encodeValue(spec, value, nameOf, context));
};

/** Decode ONE claim from its wire form — the read-side twin of {@link encodeClaim}. */
export const decodeClaim = (
  spec: ClaimMemberSpec,
  value: unknown,
  nameOf: NameSelector,
): unknown => {
  const context = claimContext(spec, value);

  return refuseIfInvalid(context, decodeValue(spec, value, nameOf, context));
};

/**
 * ENCODE ONE MEMBER — and REFUSE TO WRITE WHAT THIS PACKAGE COULD NOT READ BACK.
 *
 * ⚠⚠ THE ASYMMETRY THIS CLOSES IS A REAL ONE AND IT WAS LIVE. `encodeValue`'s
 * scalar arms return the caller's value UNCHECKED, while `decodeValue`'s check
 * it (`text` is `isString(value) ? value : undefined`), so aegis could sign a
 * token asserting a member its own reader then reported as never stated. A token
 * whose issuer and reader disagree about what it says is the one thing a
 * signature is supposed to make impossible.
 *
 * ⚠ THE EXAMPLE THIS NOTE WAS BUILT ON HAS SINCE MOVED, and saying so keeps the
 * note honest rather than merely current: it was `region: null`, chosen because
 * `AegisProfileAddress` PERMITS `null` while no text codec accepts it, so a
 * `whenEmpty: "keep"` member could meet a value its own codec rejected. `null` is
 * an ABSENCE now ({@link isNotStated}) and never reaches this function, so the
 * live example is a value of the wrong TYPE — `region: 42` from a JavaScript
 * caller, an introspection response, or any door with no declaration behind it.
 * The check is unchanged and so is the reason for it.
 *
 * ⛔⛔ THE SAME HOLE IS OPEN AT THE TOP LEVEL, KNOWN, AND DELIBERATELY OUT OF
 * SCOPE HERE. This note used to claim the two "never meet" at the top level,
 * because a claim that can fail its own decoder is "either pruned at the
 * emission boundary or never reaches the wire empty". THAT IS FALSE, and neither
 * escape applies: a value can be NON-EMPTY — so the prune never touches it — and
 * still fail its own decoder.
 *
 * ⚠ IT FAILS DIFFERENTLY ON EACH WIRE, AND THE SECOND HALF IS THE WORSE ONE.
 * Measured from ONE domain bag,
 * `aegis.mint("default", { subject: "user-1", expires: "1h", profile: { nickname: 42 } })`,
 * with the signed payload read by the INDEPENDENT inspector
 * (`__fixtures__/inspect-token.ts`):
 *   - JOSE — the payload carries `nickname: 42`; `aegis.parse(token).profile` is
 *     `undefined`. The claim is LOST: issuer and reader disagree.
 *   - COSE — the payload carries `nickname: "42"`, a TEXT STRING;
 *     `aegis.parse(token).profile` is `{ nickname: "42" }`. The claim is
 *     REWRITTEN: aegis signs a value the caller never supplied.
 * `internal/cose/cwt-spec.ts`'s `fieldForClaim` maps `{ kind: "text" }` onto
 * cbor's native `text` field kind, which COERCES the number before signing.
 * ⇒ A deployment minting a JWT and a CWT from the same content issues two
 * tokens that SAY DIFFERENT THINGS — the same "one domain call, two answers per
 * encoding" shape four of this package's six declared conformance reds have.
 * The vocabulary doors show the bare form: `Aegis.toWire({ subject: 42 })`
 * yields `{ sub: 42 }` while `Aegis.toDomain({ sub: 42 })` yields no claims.
 *
 * ⭐ THE ASYMMETRY IS THE ARGUMENT FOR EVENTUALLY CLOSING IT. The probe below
 * closes this exact hole ONE LEVEL IN — a member declared `{ kind: "text" }` and
 * handed `42` is refused, on both wires — so a structure's MEMBERS are protected
 * and the TOP-LEVEL claims around them are not. The same package answers the
 * same question two ways depending on depth.
 *
 * It is NOT fixed here because the fix is `domainToWire` running this same
 * derived check, which changes behaviour for every registered claim in both
 * directions and is its own step with its own corpus gate. It is filed as a
 * defect with the measurement rather than argued away — an asserted-away hole is
 * worse than a recorded one, and this note asserting it away is what kept it
 * invisible.
 *
 * ⭐ THE CHECK IS DERIVED FROM THE DECODER, not restated beside it. Asking "would
 * the read side keep this?" by running the read side is the only formulation
 * that cannot drift from it; a hand-written per-kind predicate here would be a
 * third copy of codec knowledge and would disagree with the decoder the first
 * time either changed.
 *
 * ⚠ It does NOT make the member's EMPTINESS a codec question. `""` is a text
 * value, so the codec accepts it and `whenEmpty` alone decides whether it rides
 * — which is what that column's docstring already claims to be true.
 *
 * ⚠⚠ IT IS ONLY AS STRONG AS THE DECODE ARM IT ASKS, AND TWO ARMS ANSWER
 * NOTHING. The list is EXHAUSTIVE over `decodeValue`'s arms, so a new codec kind
 * has to be placed in one column or the other:
 *   - CHECKS, so the promise above holds: `text` (`isString`), `int`
 *     (`isFinite`), `date` (`toDate`), `bstr` (`isString`), `array` (its
 *     `ArrayScalar` policy, or its element walk when it declares `of`), and
 *     `object` (a non-object walks to `undefined`), and BOTH `bespoke` sub-kinds
 *     (the `events` arm returns `undefined` for a non-object; the `confirmation`
 *     arm goes further and REFUSES one, along with any member whose value
 *     contradicts its declared shape).
 *   - VACUOUS, so the promise buys nothing: `bool` alone, which returns its input
 *     unchanged, so `"yes"`, `null` and `{ a: 1 }` are all "accepted".
 * ⚠ `bespoke: "events"` USED TO SIT IN THE SECOND COLUMN and no longer does. The
 * reason given was that "an RFC 8417 event map's payloads are third-party shapes
 * this package cannot describe" — which is true of the PAYLOADS and says nothing
 * about whether the claim is a map at all. The arm checks that much now; what it
 * still does not check, correctly, is anything about the keys or the payloads.
 * `bool` is inherited unchanged and is not this walker's to tighten:
 * `emailVerified` and `phoneNumberVerified` are top-level `bool` claims, so
 * narrowing it changes what a READ of an existing foreign token reports, which
 * is a public-surface decision. Named here rather than left for a reader to
 * discover, because a guarantee with an unstated hole is worse than a narrower
 * one stated plainly.
 */
const encodeMember = (
  member: ClaimMemberSpec,
  value: unknown,
  nameOf: NameSelector,
  context: WalkContext,
): unknown => {
  const encoded = encodeValue(member, value, nameOf, context);

  if (encoded === undefined) return undefined;

  // ⚠ THE PROBE READ GETS A THROWAWAY CONTEXT. It is a question — "would the read
  // side keep this?" — not a read anyone asked for, so a violation it turns up is
  // not this token's violation to report. The WRITE walk above already recorded
  // any real one into the caller's accumulator, at the caller's own path.
  const probe: WalkContext = { claim: context.claim, path: context.path, invalid: [] };

  return decodeValue(member, encoded, nameOf, probe) === undefined ? undefined : encoded;
};

// Encode ONE registered claim's value to its JOSE wire form per the registry
// codec (exhaustive over ClaimCodec; an unknown kind throws).
//
// The translator reads the BASE codec, never a per-wire override: it produces
// the jose-shaped values BOTH wires start from, and the COSE byte layer
// (`cose/cwt-spec.ts`) applies the per-wire codec when it turns those values into
// labels and CBOR bytes. That is why `bstr` — a COSE-only codec — returns the
// value untouched here.
//
// RECURSIVE over `{ kind: "object" }`: a declared structure's members are
// encoded by this same function, so a member's codec may itself be a structure
// and nesting costs no new code. The wire SELECTOR travels with the recursion —
// a member is spelled by the wire the claim is being written for, never by a
// second rule kept somewhere else.
/**
 * ⚠ THE RECURSION, not a door. Every caller — including the drift guard — enters
 * through {@link encodeClaim}, which owns the context and the refusal; entering
 * here would mean inventing a context, and a walk whose context was invented for
 * it reports paths nobody would see in production.
 */
const encodeValue = (
  spec: ClaimMemberSpec,
  value: unknown,
  nameOf: NameSelector,
  context: WalkContext,
): unknown => {
  const codec = spec.codec;

  switch (codec.kind) {
    case "text":
    case "int":
    case "bool":
      return value;
    case "array":
      return codec.of === undefined
        ? value
        : walkElements(codec.of, value, writeDirection(nameOf), context);
    case "date":
      return value instanceof Date ? getUnixTime(value) : undefined;
    case "bstr":
      return value; // JOSE keeps the string; only COSE turns it into bytes
    case "object":
      return walkObject(codec, value, writeDirection(nameOf), context);
    case "bespoke":
      return encodeBespoke(spec, codec.bespoke, value, context);
    default: {
      // The `never` binding is on `codec` — that is what makes the compiler bite
      // on a new ClaimCodec member. The REPORTED fact must be the `kind` STRING:
      // stringifying the codec OBJECT yields "[object Object]" and loses the one
      // fact this handler exists to name.
      const exhaustive: never = codec;
      throw new AegisDomainError("Unhandled claim value kind", {
        code: "translate_unhandled_value_kind",
        data: { kind: String((exhaustive as ClaimCodec).kind) },
        title: "Unhandled Claim Value Kind",
        details:
          "The claim registry declared a value kind the translator has no encoder for.",
      });
    }
  }
};

/**
 * The write core (domain -> wire), single-pass over the claims. Registered
 * claims map to the selected wire NAME with their value encoded per `spec.value`;
 * unregistered custom claims keep their value and flip their KEY to snake_case.
 * Undefined results (an absent value, an empty `cnf`) are dropped. The
 * VALUE encoding is identical for JOSE and COSE — only `nameOf` differs.
 *
 * EXPORTED, and the only write door: the wire is a PARAMETER, so there is no
 * `domainToCose` to keep in agreement with it. `domainToJose` below is not a
 * second door but a one-line binding of `joseName`, because the public vocabulary
 * door (`Aegis.toWire`) speaks JOSE.
 */
export const domainToWire = (common: Dict, nameOf: NameSelector): Dict => {
  const wire: Dict = {};

  for (const [key, value] of Object.entries(common)) {
    if (value === undefined) continue;

    const spec = claimByDomain(key);
    if (spec) {
      // ⚠⚠ `null` IS NOT STATED AT THE CLAIM LEVEL TOO, and the alternative was
      // measured before it was declined: with the structure refusal below in
      // place and this line absent, `address: null` — the ordinary shape of a
      // nullable column, and the exact case the member-level ruling exists for —
      // becomes a THROWN error one level up from where it is omitted. Whatever
      // the answer is, it cannot be "absent inside a structure and refused at the
      // top of one".
      // ⚠ It is asked for a REGISTERED claim ONLY. An unregistered custom claim
      // has no declared shape for a value to contradict and no disposition aegis
      // has stated for it; it is carried exactly as written, which is the same
      // rule `internal/claims/prune-empty-claims.ts` keeps at the emission
      // boundary ("aegis does not reshape what it has not declared").
      if (isNotStated(value)) continue;

      const encoded = encodeClaim(spec, value, nameOf);
      if (encoded !== undefined) wire[nameOf(spec)] = encoded;
    } else {
      // ⚠ SAFE ONLY BECAUSE `snakeCase` CANNOT RETURN `__proto__` — measured:
      // `__proto__`, `__PROTO__` and `--proto--` all yield `proto`. That is what
      // makes a plain assignment admissible here where the unconverted bags need
      // `Object.fromEntries`. A key transform that preserved leading underscores
      // would reopen it.
      wire[snakeCase(key)] = value;
    }
  }

  return wire;
};

/**
 * Domain-keyed common claims -> JOSE-keyed wire dict. The PUBLIC vocabulary door
 * (`Aegis.toWire`), which speaks JOSE because the domain engine does; every
 * internal write site calls {@link domainToWire} with its own codec's selector.
 */
export const domainToJose = (common: Dict): Dict => domainToWire(common, joseName);

export type WireToDomainResult = {
  claims: Dict;
  custom: Dict;
};

// Dispatch ONE `bespoke` claim's value to its per-claim DOMAIN decoder, keyed by
// the registry codec's `bespoke` sub-kind — the read-side twin of
// `encodeBespoke`. Every {@link BespokeKind} is enumerated here; an unhandled
// sub-kind (a registry/translator drift) throws loudly (the house
// exhaustive-switch idiom).
const decodeBespoke = (
  spec: ClaimMemberSpec,
  bespoke: BespokeKind,
  value: unknown,
  context: WalkContext,
): unknown => {
  switch (bespoke) {
    case "confirmation":
      // ⚠ NO EMPTINESS VERDICT ON THIS SIDE. A read reports what a PRODUCER
      // wrote, and a `cnf: {}` on a foreign token is a statement the reader must
      // be able to see — it is the VERIFIER's gate that refuses it
      // (`internal/utils/apply-verify-policy.ts`), where the refusal is about the
      // token being presented rather than about a claim being assembled. Erasing
      // it here would put this decoder back where it was: reporting a token as
      // saying less than it says.
      return walkConfirmation(value, cnfMemberByJose, (member) => member.domain, context);
    case "events":
      // The SAME guard the write arm asks, and the same refusal — a SET events
      // map is keyed by event-type URIs (RFC 8417 §2.2), which are identifiers
      // rather than field names, so the keys are carried verbatim and must NOT be
      // case-converted (which is what the `address` arm that used to sit below
      // this one did). See {@link eventsMap} for why a non-object is refused
      // rather than dropped, and for the asymmetry the shared function closed.
      return eventsMap(value, context);
    default: {
      const exhaustive: never = bespoke;
      throw new AegisDomainError("Unhandled bespoke claim sub-kind", {
        code: "translate_unhandled_bespoke_domain",
        data: { domain: spec.domain, bespoke: String(exhaustive) },
        title: "Unhandled Bespoke Claim Sub-Kind",
        details:
          "The claim registry declared a bespoke claim the translator has no decoder for.",
      });
    }
  }
};

// How an array claim tolerates a SCALAR on read, per the codec's own policy.
// This used to be a hardcoded `spec.domain === "audience"` branch plus a set
// derived from the registry; it is one exhaustive switch over registry data now.
//
// The `default` is NOT redundant: the declared return type is `unknown`, so
// falling off the end is legal and a new {@link ArrayScalar} member would compile
// clean and DROP the claim on read. The `never` binding is what makes the
// compiler bite instead (the house exhaustive-switch idiom, as in
// `encodeBespoke`/`decodeBespoke`).
const decodeArray = (
  spec: ClaimMemberSpec,
  scalar: ArrayScalar,
  value: unknown,
): unknown => {
  switch (scalar) {
    case "wrap":
      return toAudience(value); // RFC 7519 aud: string-OR-array
    case "spaced":
      return toStringArray(value); // scope, roles, permissions, conformsTo
    case "strict":
      return isArray(value) ? value : undefined; // amr, entitlements, groups, afc
    default: {
      const exhaustive: never = scalar;
      throw new AegisDomainError("Unhandled array scalar policy", {
        code: "translate_unhandled_array_scalar",
        data: { domain: spec.domain, scalar: String(exhaustive) },
        title: "Unhandled Array Scalar Policy",
        details:
          "The claim registry declared an array scalar-tolerance policy the translator has no decoder for.",
      });
    }
  }
};

// Decode ONE registered claim's value from its wire form to the domain form
// (exhaustive over ClaimCodec; an unknown kind throws), reproducing
// hand-written per-claim decoders exactly. The `array` case refines by the
// codec's own scalar-tolerance policy — `wrap` for `aud` (RFC 7519 string-OR-
// array), `spaced` for the space-delimited sets, `strict` for the rest — which
// used to be a hardcoded `spec.domain === "audience"` branch here.
//
// RECURSIVE over `{ kind: "object" }`, the mirror of `encodeValue`: the member
// set is keyed by WIRE name here and answers under its DOMAIN name, and the same
// wire selector travels down, so a COSE-keyed structure is read by the COSE
// spelling of its members and a JOSE-keyed one by the JOSE spelling.
const decodeValue = (
  spec: ClaimMemberSpec,
  value: unknown,
  nameOf: NameSelector,
  context: WalkContext,
): unknown => {
  const codec = spec.codec;

  switch (codec.kind) {
    case "text":
      return isString(value) ? value : undefined;
    case "int":
      return isFinite(value) ? value : undefined;
    case "date":
      return toDate(value);
    case "bool":
      return value;
    case "bstr":
      return isString(value) ? value : undefined; // the JOSE string form
    case "array":
      return codec.of === undefined
        ? decodeArray(spec, codec.scalar, value)
        : walkElements(codec.of, value, readDirection(nameOf), context);
    case "object":
      return walkObject(codec, value, readDirection(nameOf), context);
    case "bespoke":
      return decodeBespoke(spec, codec.bespoke, value, context);
    default: {
      // See `encodeValue`: the `never` binding is the compiler backstop, but the
      // REPORTED fact must be the string discriminant — `String(codec)` on the
      // codec object reads "[object Object]".
      const exhaustive: never = codec;
      throw new AegisDomainError("Unhandled claim value kind", {
        code: "translate_unhandled_value_kind",
        data: { kind: String((exhaustive as ClaimCodec).kind) },
        title: "Unhandled Claim Value Kind",
        details:
          "The claim registry declared a value kind the translator has no decoder for.",
      });
    }
  }
};

/**
 * WHICH claims a read pass resolves, WHICH input names it will answer to, and
 * what becomes of the keys it does not consume. Three facts, one closed set, so
 * a fourth door cannot be added by accident.
 *
 *   - `"token"`  reading a TOKEN's wire payload. A registered claim resolves ONLY
 *                under its wire name; an unregistered key flips snake -> camelCase
 *                into `custom`. This is what verify/parse/decrypt read.
 *   - `"floor"`  the profiled verify FLOOR read of a token: wire names only, only
 *                `domainClaim`-marked claims resolve (the {@link DomainClaims}
 *                set), and every other key stays in `custom` VERBATIM.
 *   - `"dict"`   the PUBLIC vocabulary door (`Aegis.toDomain`), whose input is a
 *                claim dict of unknown provenance — an introspection response, a
 *                userinfo body, or an already-domain-shaped set. It therefore
 *                answers to EITHER spelling, domain form winning.
 *
 * ⚠⚠ The wire-name-only rule on the two TOKEN modes is the load-bearing one.
 * Which claim an ISSUER stated is decided by the registered wire claim and by
 * nothing else; letting a look-alike custom claim answer under the domain
 * spelling hands that decision to whoever presents the token. A token carrying
 * both `aud: ["someone-else"]` and a custom `audience: [me]` must fail the
 * audience floor on the `aud` it actually states.
 *
 * ⚠⚠ `"floor"`'s verbatim rule is equally load-bearing. The floor asks "is this
 * claim present ON THE WIRE"; case-converting first would let a wire `expires_at`
 * camelCase to `expiresAt` and satisfy an `exp`-presence floor. A profile may
 * also name a required claim in its WIRE spelling (`introspection` names
 * `token_introspection`), which only resolves against a verbatim `custom`.
 */
export type ClaimReadMode = "token" | "floor" | "dict";

/**
 * What a {@link ClaimReadMode} decides, resolved ONCE per read.
 *   - `resolves`   whether the pass looks this registered claim up at all.
 *   - `lookup`     which input key, if any, the claim is read from.
 *   - `customKey`  how a key the pass did not consume is spelled in `custom`.
 *
 * The three facts travel together because they are one policy, and deciding them
 * in a single `switch` is what makes a fourth mode a COMPILE error rather than a
 * silent fall into another door's behaviour — the failure a scatter of
 * `mode === "floor"` ternaries invites.
 */
type ClaimReadRules = {
  resolves: (spec: ClaimSpec) => boolean;
  lookup: (spec: ClaimSpec, wireName: string, wire: Dict) => string | undefined;
  customKey: (key: string) => string;
};

/**
 * ⚠ BOTH LOOKUPS USE `Object.hasOwn`, NEVER `in`.
 *
 * `wire` is a STRANGER'S payload — a decoded token, or the dict a public door
 * was handed — and `in` walks the prototype chain, so `toString`, `constructor`,
 * `valueOf`, `hasOwnProperty` and `__proto__` are members of every object
 * literal that ever reaches here. A registry name colliding with one of those
 * would make the lookup answer YES for a claim the payload does not carry, and
 * the decoder would then read a FUNCTION off `Object.prototype` as a claim value.
 *
 * ⚠⚠ THIS NOTE USED TO CLAIM COVERAGE IT DID NOT HAVE. It said the fault is
 * LATENT because no registered name collides with an `Object.prototype` member,
 * and pointed at `translate.test.ts` as deriving that non-collision from the
 * registry. The derivation is real — and it is a proposition about the REGISTRY,
 * not about this lookup. Measured: swapping `Object.hasOwn` for `in` here left the
 * whole suite green.
 *
 * ⛔ IT IS ALSO NOT ONLY LATENT. A collision is not the only way to reach the
 * fault: ANY library in the process that writes to `Object.prototype` supplies one
 * — `Object.prototype.aud = ["evil-rs"]` and a token that carries no `aud` is
 * suddenly read as stating one, which is an access decision handed to whatever
 * else is loaded. `translate.test.ts` now drives exactly that, so the MECHANISM is
 * pinned rather than the registry's current shape.
 *
 * The house rule stands regardless: a membership test whose KEY can come from a
 * caller uses `Object.hasOwn`, because the alternative is a fault that only
 * announces itself through a wrong answer.
 */

/** A token states a claim under its WIRE name. Nothing else answers for it. */
const wireLookup = (
  _spec: ClaimSpec,
  wireName: string,
  wire: Dict,
): string | undefined => (Object.hasOwn(wire, wireName) ? wireName : undefined);

/** The public dict door accepts either spelling; the domain form wins. */
const eitherLookup = (
  spec: ClaimSpec,
  wireName: string,
  wire: Dict,
): string | undefined =>
  Object.hasOwn(wire, spec.domain)
    ? spec.domain
    : Object.hasOwn(wire, wireName)
      ? wireName
      : undefined;

const claimReadRules = (mode: ClaimReadMode): ClaimReadRules => {
  switch (mode) {
    case "token":
      return { resolves: () => true, lookup: wireLookup, customKey: camelCase };
    case "floor":
      return {
        resolves: (spec) => spec.domainClaim !== undefined,
        lookup: wireLookup,
        customKey: (key) => key,
      };
    case "dict":
      return { resolves: () => true, lookup: eitherLookup, customKey: camelCase };
    default: {
      const exhaustive: never = mode;
      throw new AegisDomainError("Unhandled claim read mode", {
        code: "translate_unhandled_read_mode",
        data: { mode: String(exhaustive) },
        title: "Unhandled Claim Read Mode",
        details: "A ClaimReadMode member has no rules in the claim read core.",
      });
    }
  }
};

/**
 * The read core (wire -> `{ claims, custom }`), single-pass over the registry.
 * Registered claims resolve to `spec.domain` with their value decoded. The VALUE
 * decoding is identical for JOSE and COSE and for every read mode — only `nameOf`
 * and the {@link ClaimReadMode} differ.
 *
 * Exported because `resolve-domain-buckets.ts` continues from here to the
 * four-bucket shape every read door shares.
 *
 * ⚠ This TWO-bucket form is the right one for the profiled verify FLOOR, which
 * needs every domain claim flat in one dict: a profile's `required` rules may name a
 * profile-category claim, and bucketing it away would report a present claim as
 * missing.
 */
export const wireToDomain = (
  wire: Dict,
  nameOf: NameSelector,
  mode: ClaimReadMode,
): WireToDomainResult => {
  const rules = claimReadRules(mode);
  const consumed = new Set<string>();
  const claims: Dict = {};

  for (const spec of CLAIM_SPECS) {
    // The floor read resolves ONLY the extracted set; every other registered
    // claim is left for `custom`, verbatim, exactly as it arrived.
    if (!rules.resolves(spec)) continue;

    const key = rules.lookup(spec, nameOf(spec), wire);
    if (key === undefined) continue;

    // ⚠ CONSUMED EITHER WAY. The key IS the registered claim, whatever it holds,
    // so leaving an unstated one to fall through to `custom` would report a
    // registered claim under a custom spelling — and, on the floor read, hand a
    // presenter-supplied look-alike the slot the real claim vacated.
    consumed.add(key);

    // ⚠⚠ A WIRE `null` IS NOT STATED — the read half of the same ruling the write
    // core states above, and the half a token can actually exercise: JSON and
    // CBOR both express `null` and neither expresses `undefined`, so this is the
    // only spelling of absence a stranger's payload can carry. It runs BEFORE the
    // codec so `cnf: null` is read as "no confirmation" rather than refused as an
    // unreadable one, and so a `bool` claim's permissive arm cannot report
    // `emailVerified: null` in a field typed `boolean`.
    if (isNotStated(wire[key])) continue;

    const decoded = decodeClaim(spec, wire[key], nameOf);
    if (decoded !== undefined) claims[spec.domain] = decoded;
  }

  // ⛔ `Object.fromEntries`, NEVER `custom[key] = value`. The keys are the WIRE's,
  // so a token carrying `__proto__` reaches here as an own property — the FLOOR
  // read keys unconverted (`customKey: (key) => key`), so it arrives verbatim —
  // and a plain assignment makes it this bag's PROTOTYPE instead of a member.
  // `fromEntries` DEFINES each key, so the name is carried like any other.
  //
  // ⚠ THIS IS ONE OF TWO REBUILDS ON THIS PATH, and closing it alone is not
  // enough: `wireToFloorClaims` rebuilds the same bag again to drop shadowing
  // names. Both define their keys; a fix to either that skipped the other left the
  // door broken while this function passed.
  // pinned where the second rebuild lives:
  // translate.test.ts#carries a `__proto__` wire key as an own key.
  const custom: Dict = Object.fromEntries(
    Object.entries(wire)
      .filter(([key]) => !consumed.has(key))
      .map(([key, value]) => [rules.customKey(key), value]),
  );

  return { claims: omitUndefined(claims), custom };
};

/**
 * The verify-FLOOR read: a token's raw wire claims -> `{ claims, custom }` where
 * `claims` is the {@link DomainClaims} set and `custom` holds every remaining key
 * under its ORIGINAL spelling. The profiled verify pipeline flattens the two back
 * together and asks the floor what is present.
 *
 * The wire is a PARAMETER: both wires reach this one read, so a claim spelling a
 * floor accepts cannot diverge between them.
 */
export const wireToFloorClaims = (
  wire: Dict,
  nameOf: NameSelector,
): WireToDomainResult => {
  const { claims, custom } = wireToDomain(wire, nameOf, "floor");

  // ⚠ A key the pass did NOT consume that is spelled like a claim the floor
  // resolves can only be a LOOK-ALIKE: the real claim would have been consumed
  // under its wire name. The floor's caller flattens `custom` and `claims` into
  // one dict, so leaving it in would let a presenter-supplied `audience` answer
  // for an ABSENT `aud` — a token that states no audience clearing the audience
  // floor. Which claim the issuer stated is decided by the registered wire claim
  // and by nothing else, and that has to hold when the claim is missing too.
  //
  // Only the RESOLVED set is filtered. A profile may require a claim under its
  // wire spelling (`introspection` requires `token_introspection`) or a claim the
  // floor does not resolve at all (`events`), and both must survive verbatim.
  // ⛔ `Object.fromEntries`, for the same reason the bag was built with it: this is
  // a SECOND rebuild over the same wire-controlled keys, and the floor read keys
  // unconverted, so `__proto__` reaches here as an own property. An assignment
  // makes it this bag's prototype, which DROPS the member.
  //
  // ⚠ WHAT THAT COSTS IS A FLOOR JUDGEMENT ON CLAIMS THE TOKEN DID NOT PRESENT.
  // This bag is spread into `enforceVerifyFloor`'s payload
  // (`internal/utils/verify-token.ts`), so a dropped claim is one a `forbidden`
  // rule no longer sees and a `required` rule reports missing. It reaches no
  // caller — the floor bag is consumed there and discarded — so the cost is the
  // verdict, not a polluted result.
  // pinned: translate.test.ts#carries a `__proto__` wire key as an own key.
  const filtered: Dict = Object.fromEntries(
    Object.entries(custom).filter(([key]) => !floorShadows(key)),
  );

  return { claims, custom: filtered };
};

/** The DOMAIN names the floor read resolves — the set a custom key may not impersonate. */
const FLOOR_DOMAINS = new Set(
  CLAIM_SPECS.filter((spec) => spec.domainClaim !== undefined).map((spec) => spec.domain),
);

const floorShadows = (key: string): boolean => FLOOR_DOMAINS.has(key);
