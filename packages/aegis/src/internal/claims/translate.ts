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

/**
 * The ONE claim translator: TWO parameterized cores (`domainToWire` /
 * `wireToDomain`), with the wire as a `NameSelector` PARAMETER of both.
 *
 * The only thing that varies between JOSE and COSE is the wire NAME emitted or
 * looked up — `joseName` vs `coseName` (the RFC 8392 §3.1.7 divergence set, today
 * just `jti` <-> `cti`). The VALUE transforms are identical here; the downstream
 * CWT codec turns the jose-shaped values into COSE labels and CBOR bytes. ⛔ There
 * is deliberately no `domainToCose` / `coseToDomain` beside the two cores: a
 * second named entry point per wire is a second place for a rule to be written
 * differently.
 *
 * It is the ONLY domain-aware claim code — both format paths meet here. Value
 * transforms come from the registry's `ClaimCodec`; a co-located BESPOKE builder
 * table holds the two claims the generic member-set walker cannot serve (`cnf`,
 * `events` — see `internal/claims/cnf-members.ts` and {@link BespokeKind}), and
 * the generic structure walker handles the rest. A registered claim takes the
 * registry path (name + value transform); anything NOT registered is a custom
 * claim whose KEY case flips mechanically (snake on write, camel on read) with
 * its value untouched.
 *
 * Hash DERIVATION is NOT here — it needs the signing algorithm and stays in
 * `assemble-common-claims.ts`, so this file is mechanical and algorithm-free.
 */

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
 * ⭐ BOTH DIRECTIONS ARE DRIVEN BY ONE DECLARATION — `internal/claims/cnf-members.ts`
 * — so a member cannot be added to one side and not the other.
 *
 * ⚠⚠ NEITHER SIDE ACCEPTS THE OTHER VOCABULARY'S SPELLING FOR A DECLARED MEMBER.
 * Tolerating one (reading `v.thumbprint ?? v.jkt`) lets a presenter-supplied
 * look-alike answer for an absent registered member — the same hazard the
 * top-level read closes by resolving a claim under its WIRE name alone
 * ({@link ClaimReadMode}). A misspelled member is REFUSED for the collision; see
 * the UNCONDITIONAL reservation in {@link walkConfirmation}, which is what makes
 * that hold when only ONE of the two names is present.
 *
 * ⚠⚠ A MEMBER WHOSE VALUE CONTRADICTS ITS DECLARED SHAPE IS REFUSED, NOT DROPPED,
 * ON BOTH SIDES. Erasing it collapses the whole confirmation to `undefined` and
 * the token VERIFIES AS A PLAIN BEARER — an attacker who can blank one field
 * turns a sender-constrained token into one anybody holding a copy may present.
 * A binding the issuer STATED and this package cannot read cannot be honoured,
 * and the only safe disposal of one is a refusal.
 *
 * ⚠ AN EMPTY CONFIRMATION IS REFUSED TOO — see {@link cnfBinding}. Collapsing it
 * to `undefined` mints the same silent bearer token.
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
   * ⭐⭐ EVERY DECLARED MEMBER'S OUTGOING KEY IS RESERVED UNCONDITIONALLY, whether
   * or not that member is present. This is the whole of the collision defence,
   * and the UNCONDITIONAL part is what makes it hold.
   *
   * ⛔⛔ RESERVING ONLY WHAT ARRIVES LEAVES THE ATTACK FULLY OPEN. A `cnf` naming
   * just ONE of a declared/wire pair has nothing to collide with, so the
   * look-alike takes the declared member's own slot: on WRITE, a caller spelling
   * `confirmation: { jkt }` skips the DOMAIN-keyed shape rule entirely; on READ, a
   * foreign `cnf: { thumbprint }` lands where
   * `internal/utils/apply-verify-policy.ts` reads the bound thumbprint and drives
   * the DPoP gate. ⇒ A key a declared member OWNS is refused to the tail
   * outright. The tail rides because an unknown member must be ignored
   * (RFC 7800 §3.1); a MISSPELLED one is not unknown, and honouring it lets the
   * token's writer choose which vocabulary aegis reads the binding in.
   *
   * ⚠ IT ALSO SUBSUMES THE BOTH-PRESENT CASE, which is why there is no second
   * mechanism beside it: `{ jkt, thumbprint }` is refused by this one check
   * whichever arrives first.
   *
   * ⚠ A `Map` keyed by the OUTGOING name, holding the member's own INCOMING name,
   * so the refusal can say which two names met. Two declared members cannot
   * collide with each other (`cnf-members.test.ts` pins the spellings apart) and
   * two tail keys cannot collide at all — they are keys of one object.
   */
  const declaredOutKeys = new Map<string, string>();
  for (const [incoming, member] of lookup) {
    declaredOutKeys.set(outKeyOf(member), incoming);
  }

  for (const [key, inner] of Object.entries(value)) {
    const member = lookup.get(key);

    // An undeclared member rides VERBATIM rather than being refused or
    // case-flipped: a tail member is another specification's registered
    // confirmation-method name (RFC 7800 §3.1, RFC 7800 §6.2.1).
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
      // exemption the declared members take (RFC 7800 §6.2): a tail member is
      // somebody's confirmation method, not a spare attribute, so erasing a null
      // one lets a caller state a binding this package silently drops. See the
      // declared-member note below.
      if (inner === undefined) continue;

      Object.defineProperty(out, key, {
        value: inner,
        configurable: true,
        enumerable: true,
        writable: true,
      });
      continue;
    }

    // `undefined` is how absence is spelled throughout this package, so a member a
    // caller assembled from an optional it did not have is ABSENT rather than
    // malformed. Neither JSON nor CBOR can express it, so on the read side it can
    // only come from a caller's own dict at the vocabulary door.
    //
    // ⛔⛔ `null` IS **NOT** ABSENCE HERE, AND `cnf` IS THE ONE CLAIM EXEMPT FROM
    // THAT RULING. Everywhere else a null member is omitted ({@link isNotStated});
    // a confirmation member falls through to the refusal below instead, for three
    // reasons that hold together:
    //
    //   1. ERASING ONE MINTS AN UNBOUND TOKEN. `domainToWire` would erase the
    //      member before the COSE fail-closed guard runs, and that guard asks
    //      `cnf[member] !== undefined` (`internal/cose/cose-key.ts`) — so an
    //      already-erased `jkt` is not "unrepresentable on COSE", it is nothing at
    //      all. A caller asking for a thumbprint binding would receive a token
    //      nobody is ever asked to prove possession for, byte-indistinguishable
    //      from a legitimate key-id binding, on both wires.
    //      pinned: `classes/confirmation-claim-wire.test.ts`.
    //   2. RFC 9449 §6.1 TYPES THE MEMBER, BY MUST, so `jkt: null` is a value
    //      CONTRADICTING the declared shape rather than a position left unfilled.
    //      The ordinary argument for a carve-out — a nullable database column is an
    //      unset optional — does not reach a claim whose whole content is a key the
    //      recipient must be able to confirm.
    //   3. "ERASED" AND "ABSENT" MUST NOT COLLAPSE ON THIS CLAIM. Every other
    //      structured claim reports a fact; `cnf` states a security property whose
    //      failure mode is exactly the two becoming indistinguishable.
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
 * THE VERDICT AN EMPTY CONFIRMATION GETS (RFC 7800 §3), asked at the emission side
 * so a caller hears it before anything is signed. Neither alternative disposal is
 * a token anyone asked for: dropping it hands the audience a BEARER token where
 * the issuer asked for a bound one, and emitting it puts a binding on the wire
 * that no verifier can honour.
 *
 * ⚠ The same verdict is taken again at VERIFY
 * (`internal/utils/apply-verify-policy.ts`), on a token this package did not
 * mint. One rule, two doors — not two rules.
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
 * The RFC 8417 §2.2 SET `events` map, guarded in EITHER direction — ONE function,
 * because the two directions ask exactly one question of this claim and asking it
 * in two places is how they come to disagree.
 *
 * ⚠⚠ A NON-OBJECT IS REFUSED, NOT DROPPED — the same disposition
 * {@link walkObject} and {@link walkElements} state, reaching the one structured
 * claim with no member set to walk. A scalar under this name is not a partial
 * event map, and dropping it is invisible from both sides: a caller's events
 * vanish from a signed token with nothing said, and a stranger's token is
 * reported as carrying no events when it carries a value.
 *
 * ⚠ The KEYS are untouched, which is the whole reason this claim has its own
 * arms: an event-type URI is an identifier, and the house case flip would rewrite
 * it. ⚠ NOTHING IS SAID ABOUT THE PAYLOADS — aegis has no shape to hold one to.
 *
 * ⛔ NEITHER ARM REBUILDS THE MAP, which is why this claim never reaches
 * {@link walkObject}'s `emit` and a `__proto__` event-type key keeps the own-key
 * disposal it arrived with. Rewriting either arm to rebuild with
 * `out[key] = value` would newly make that key the map's PROTOTYPE and drop the
 * member.
 * pinned: translate.test.ts#carries a `__proto__` event-type key as an own key.
 */
const eventsMap = (value: unknown, context: WalkContext): Dict | undefined => {
  if (isObject(value)) return value;

  context.invalid.push({
    key: context.path,
    message: `Claim "${context.claim}" must be an object`,
  });

  return undefined;
};

/**
 * A spec the structure walker ENTERS: a top-level {@link ClaimSpec} or a declared
 * {@link ClaimMemberSpec} of one, since one function serves both depths.
 *
 * ⚠ IT READS `domain` AND `codec` ONLY. A member's own `whenEmpty` and
 * `required` are read off `codec.children()`, which stays `ClaimMemberSpec` — so
 * the verdicts this file implements are the ones a member may declare.
 */
type WalkedSpec = ClaimSpec | ClaimMemberSpec;

// Dispatch ONE `bespoke` claim's value to its per-claim JOSE builder, keyed by
// the registry codec's `bespoke` sub-kind. Every {@link BespokeKind} is
// enumerated here; an unhandled sub-kind (the `undefined` fall-through of a
// registry/translator drift) throws loudly (the house exhaustive-switch idiom).
const encodeBespoke = (
  spec: WalkedSpec,
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
 * THE OPEN TAIL'S CASE FLIP, applied ONE KEY AT A TIME — per key because the walk
 * below follows the VALUE's own key order rather than the declaration order, so a
 * declared and an undeclared member may interleave and the wire bytes are
 * order-sensitive.
 *
 * ⚠ IT MUST FLIP THE VALUE TOO, not just the top key. `@lindorm/case` transforms
 * each entry independently, so a one-entry bag per key and the whole bag at once
 * give the same keys at every depth; flipping only the TOP key would leave an
 * undeclared member's nested object under its inner spelling and break the round
 * trip's symmetry.
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
 * ⚠⚠ `claim` AND `path` ARE NOT THE SAME FACT ONE LEVEL APART. `claim` is the
 * TOP-LEVEL claim the walk was entered for and never changes; `path` grows with
 * every level descended. Deriving the first from the second — or passing the
 * member's own domain as both — makes a violation at `act.act.subject` report
 * `claim: "act"`, `key: "act.subject"`: indistinguishable from depth 1, and
 * identical for `act` and `mayAct`, which share one member set.
 *
 * ⚠ ONE ACCUMULATOR PER CLAIM, not per structure. Every violation anywhere under
 * a claim — across a collection's elements AND across nesting depth — is
 * collected before anything is thrown, which is the stance
 * `internal/profiles/enforce-policy.ts` takes for a whole token.
 *
 * ⭐ `claim` IS READ BELOW DEPTH 1, AND EXACTLY ONE MEMBER MAKES IT SO: the
 * non-array message in {@link walkElements}, which needs a MEMBER whose codec is
 * `array` WITH `of`. `sub_id.identifiers` (RFC 9493 §3.2.8) is that member, so
 * `subjectId: { format: "aliases", identifiers: "not-an-array" }` reports
 * `Claim "subjectId" must be an array` at key `subjectId.identifiers`. ⚠ Without
 * it a `childPath` overwriting `claim` with the member's own domain would be an
 * EQUIVALENT MUTANT — `act`'s `audience` is an array with NO `of`.
 * pinned: `classes/sub-id-claim-wire.test.ts`.
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
 * The half of a structure walk that DIFFERS between writing and reading, named so
 * a direction-dependent rule cannot be smuggled into the shared walk as a
 * symmetric one — being symmetric BY CONSTRUCTION is exactly what stops anything
 * announcing it.
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
 * Walk a DECLARED structure in ONE direction, driven by the registry's member set.
 *
 * ⭐ IT WALKS THE VALUE, NOT THE MEMBER LIST. JSON preserves insertion order, so
 * the JOSE bytes of a structured claim are decided by the order its members were
 * written in; walking the declaration instead re-orders every caller's address and
 * moves bytes on a signed wire while every round trip still passes. The same
 * discipline `prune-empty-claims.ts` states for the top-level bag, one level in.
 * (CBOR deterministic encoding sorts the keys, so JOSE is where it is observable.)
 *
 * ⚠ A member is resolved through a `Map`, never through `in` on the incoming bag.
 * The keys come from a stranger's payload on the read side, and `in` walks
 * `Object.prototype` — so `constructor` or `toString` would resolve as a member
 * name. A `Map` cannot be reached that way at all.
 *
 * ⚠⚠ A NON-OBJECT VALUE IS REFUSED, NOT DROPPED — the ruling that makes every
 * declared structure answer the same way ({@link walkElements},
 * {@link walkConfirmation}). A drop is invisible from both sides: a caller's claim
 * vanishes from a signed token with nothing said, and a stranger's token is
 * reported as saying less than its issuer signed.
 *
 * ⚠ `null` NEVER REACHES THIS GUARD. A CLAIM's value is classified at the
 * read/write core and a MEMBER's at the loop below — both by {@link isNotStated},
 * the one place that boundary is decided — while an ELEMENT takes
 * {@link walkElements}'s own `isObject`, a DIFFERENT rule because an array slot is
 * positional and cannot be left unfilled.
 *
 * ⚠ THE MESSAGE NAMES THE CLAIM AND THE `key` NAMES THE POSITION, so a member
 * whose own codec is a structure reports `Claim "act" must be an object` at key
 * `act.act`. The CLAIM is what a caller repairs and what `data.claim` carries at
 * every depth; the path says which part of it.
 *
 * ⚠ IT REPORTS A {@link ClaimMemberSpec.required} VIOLATION, IT DOES NOT THROW ON
 * ONE. The throw belongs at the CLAIM boundary ({@link encodeClaim} /
 * {@link decodeClaim}) — the only level at which "everything wrong with this
 * claim" is a complete answer, across a collection's elements and across nesting
 * depth alike.
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
   * from the DECLARATION before the walk begins, so it does not matter whether the
   * member the key belongs to is present, valid, or absent entirely.
   *
   * ⚠⚠ THE HAZARD IS THAT A DECLARED MEMBER AND AN OPEN TAIL KEY REACH THE SAME
   * OUTGOING KEY, and the last one in `Object.entries` order wins. On `address`,
   * `{ street_address, streetAddress }` resolves to one domain key; an OPEN `act`
   * has the same shape one level in (`sub` resolves to `subject`, and a verbatim
   * tail `subject` lands on `subject`), which hands ACTOR IDENTIFICATION to
   * whoever wrote the token, silently, by key order.
   *
   * ⛔⛔ RESERVING ONLY WHAT ARRIVES LEAVES THE ATTACK FULLY OPEN, in two ways.
   * Registering the key from the WRITTEN VALUE lets a declared member whose value
   * FAILS ITS OWN CODEC vacate its slot in silence — on the read side that is
   * entirely in the hands of whoever wrote the token. Registering it from the KEY
   * closes that and still covers only a member that ARRIVED: a structure naming
   * just ONE of the pair has nothing to collide with, so the look-alike takes the
   * declared slot uncontested and produces output BYTE-IDENTICAL to the genuine
   * claim. ⇒ The reservation is taken from `codec.children()`, once, before any
   * key of the incoming value is looked at.
   *
   * ⚠⚠ THIS DOES NOT NARROW THE OPEN TAIL, AND THE DISTINCTION IS THE RULING. A
   * tail key that does NOT collide is still carried (RFC 8693 §4.1, RFC 7800 §3.1);
   * one that DOES is refused. Carrying an unknown member and carrying it into a
   * declared member's own slot are two different acts.
   *
   * ⚠ A `Map` and not `Object.hasOwn` on `out`, because a member legitimately
   * named `constructor` or `toString` would resolve through `Object.prototype` and
   * be reported as a collision that never happened.
   */
  const declaredOutKeys = new Map<string, string>();
  for (const member of codec.children()) {
    declaredOutKeys.set(direction.outKeyOf(member), direction.keyOf(member));
  }

  /**
   * The outgoing keys a TAIL member has taken — a SECOND map, because the two
   * answer different questions and only one of them can be built ahead of time.
   *
   * ⚠ IT EXISTS FOR `open: "flip"` ALONE, which is why it survives the
   * unconditional reservation above. Two DISTINCT undeclared keys can flip onto
   * one key (`foo_bar` and `fooBar` both camelise to `fooBar`), so a tail can
   * collide with another tail — which no declaration can predict. A `"verbatim"`
   * tail cannot: its outgoing key IS its incoming key.
   *
   * ⛔ DECLARED MEMBERS MUST NOT REGISTER HERE. Their keys are reserved by
   * construction above, and a tail that would land on one is refused before
   * reaching this map — so a declared member's own write cannot be refused by a
   * key some other member took.
   */
  const claimedByTail = new Map<string, string>();

  /**
   * The members whose WRITTEN value did not survive its own codec — the one fact
   * the mandatory-member check below cannot recover afterwards.
   *
   * ⚠ `out` CANNOT STAND IN FOR IT. Three different faults leave a member missing
   * from `out` — absent, pruned as empty (`whenEmpty: "prune"`), or a value that
   * failed its codec — and only the third is a shape problem. A guard built on
   * `Object.hasOwn(out, …)` reports the pruned case as a shape fault.
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
   * ⛔ `Object.defineProperty`, NEVER `out[key] = value`. The `open: "verbatim"`
   * tail below is the site that needs it: its outgoing key IS the incoming one,
   * so `__proto__` arrives as an own key and an assignment would make it `out`'s
   * prototype instead of a member. The other two callers cannot reach that key —
   * a `"flip"` tail's key has been through `flipOneKey`, where `snakeCase` and
   * `camelCase` both yield `proto`, and a declared member's key comes from
   * `codec.children()`, a closed registry list — so they share this writer rather
   * than a second rule. The same disposal {@link wireToDomain} and
   * {@link wireToFloorClaims} take with `Object.fromEntries`.
   * pinned: translate.test.ts#carries a `__proto__` member of an open tail as an own key.
   */
  const emit = (outKey: string, outValue: unknown): void => {
    Object.defineProperty(out, outKey, {
      value: outValue,
      configurable: true,
      enumerable: true,
      writable: true,
    });
  };

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
      // ⛔⛔ NO REGISTERED CLAIM IS CLOSED TODAY — `act`/`mayAct` (RFC 8693 §4.1,
      // RFC 8693 §4.4) and `cnf` (RFC 7800 §3.1, RFC 7800 §6.2) all carry an open
      // tail. ⇒ THE BRANCH IS KEPT AND THE CELL IS REQUIRED INSTEAD: the hazard is
      // that `open?:` lets a structure reach this arm BY OMISSION, at any depth,
      // with nothing said, which is how a nested `act` member can ship closed while
      // `act` itself is open. {@link ObjectCodec.open} is a required three-way
      // cell, and `"closed"` is what a structure says when its specification
      // enumerates its members and forbids the rest. `translate.test.ts` keeps the
      // arm live.
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
     * A member whose codec is `{ kind: "object" }` or `{ kind: "array", of }`
     * reaches {@link walkObject} or {@link walkElements}, each pushing its own
     * entry before returning `undefined`, so `act: { act: 42 }` is REFUSED at
     * every depth. A LEAF codec — `text`, `int`, `date`, `bool`, `bstr`, an array
     * of strings — has no walker to speak for it, so
     * `Aegis.toWire({ act: { subject: 42 } })` yields `{ act: {} }`.
     *
     * ⚠ `null` NEVER REACHES THIS LINE — classified as absence above, so neither
     * dropped-as-malformed nor refused. See {@link isNotStated}.
     *
     * ⚠ THE DROP IS RECORDED even though it is not refused, so the
     * mandatory-member check below can tell "you wrote a value of the wrong shape"
     * from "you wrote nothing". Nothing else reads it.
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
    // `isClaimSatisfied` is false in three situations that are not one repair: the
    // member is ABSENT, it is present and EMPTY, or it was WRITTEN and its value
    // did not survive its own codec. Telling the third "must not be empty" sends a
    // caller who wrote `authorizationDetails: [{ type: 42 }]` looking for a field
    // they already wrote.
    //
    // ⚠ THE DISCRIMINATOR IS RECORDED AT THE DROP, not reconstructed here — see
    // `codecRejected` above for why `out` cannot tell the three apart. The first
    // two share their wording deliberately: several scenario rows pin the string,
    // and "must not be empty" is the right instruction for both.
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
 * ⚠⚠ IT RUNS IN BOTH DIRECTIONS AND UNDER EVERY PROFILE, INCLUDING NONE. A
 * structure's mandatory member is a SHAPE fact: it holds wherever the structure
 * does, so a profile `shape` rule cannot carry it — one bound to a single profile
 * lets every other profile, and the profile-less vocabulary door, mint the same
 * malformed structure with nothing said.
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
  translate: (member, inner, context) => encodeIfReadable(member, inner, nameOf, context),
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
 * ⚠ EVERY ELEMENT IS WALKED BEFORE ANYTHING IS REPORTED, and every violation goes
 * into the CLAIM's accumulator — stopping at the first would report one reason
 * where the caller has two to fix.
 *
 * ⚠⚠ A NON-ARRAY VALUE, AND A NON-OBJECT ELEMENT, ARE BOTH REPORTED AS
 * VIOLATIONS — which is NOT what the sibling `array` arm does. `decodeArray`'s
 * `strict` policy DROPS a scalar, which is right for an array of strings:
 * `ArrayScalar` answers a tolerance question about a scalar standing in for an
 * array, and a dropped `amr` is a claim the token is read as not stating. No
 * scalar can stand in for a STRUCTURE, so a value that is not a collection of
 * structures is not a partial `authorization_details`.
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

    // ⚠ THE ELEMENT'S OWN SHAPE IS JUDGED HERE, NOT INSIDE {@link walkObject}, to
    // keep ONE entry per fault: {@link walkObject} REFUSES a non-object, so letting
    // a bad element fall into it pushes TWO entries at one path. This message is
    // the one kept because it names the INDEX — "element 0 of a collection is not a
    // structure" is a different repair from "this claim is not a structure".
    // ⚠⚠ AN ELEMENT IS POSITIONAL, SO `null` IS **NOT** ABSENCE HERE — the one
    // place in this file where it is not. A member is named and can go unnamed; an
    // array slot cannot be left unfilled without changing every later index, so
    // `[null]` states a first element that is not a structure (RFC 9396 §2).
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
 * ⚠ THAT COMPLETENESS STOPS AT THE CLAIM, AND A TOKEN CAN BE WRONG IN TWO PLACES
 * AT ONCE. `internal/utils/mint-token.ts` enforces the profile policy BEFORE any
 * wire assembly, so a token failing both a policy rule and a structure reports
 * only the POLICY half and this refusal never runs. Both attempts still REFUSE, so
 * it costs a caller a second round trip rather than a wrong token — but it cuts
 * against the stance above. Fixing it means the structural walk running before, or
 * alongside, policy enforcement: an ordering change across the whole mint
 * pipeline, filed rather than smuggled in here.
 */
const claimContext = (spec: WalkedSpec): WalkContext => ({
  claim: spec.domain,
  path: spec.domain,
  invalid: [],
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
 * the read side — are unobservable through the public doors, so a synthetic
 * {@link ClaimMemberSpec} handed to the REAL boundary is what exercises them.
 * Which declared members can and cannot observe the rule is stated where the
 * guard runs: `translate.test.ts`, "walkObject — the structure walker's
 * direction guard".
 * ⭐ The BOUNDARY is exported rather than the recursion beneath it, so the guard
 * runs the same entry point production does, context creation and refusal
 * included.
 */
export const encodeClaim = (
  spec: WalkedSpec,
  value: unknown,
  nameOf: NameSelector,
): unknown => {
  const context = claimContext(spec);

  return refuseIfInvalid(context, encodeIfReadable(spec, value, nameOf, context));
};

/** Decode ONE claim from its wire form — the read-side twin of {@link encodeClaim}. */
export const decodeClaim = (
  spec: WalkedSpec,
  value: unknown,
  nameOf: NameSelector,
): unknown => {
  const context = claimContext(spec);

  return refuseIfInvalid(context, decodeValue(spec, value, nameOf, context));
};

/**
 * ENCODE — and REFUSE TO WRITE WHAT THIS PACKAGE COULD NOT READ BACK.
 *
 * ⭐ ONE function at BOTH depths: {@link encodeClaim} enters here for a top-level
 * claim and {@link walkObject} for a member of one, so nothing about the rule is
 * decided by how deep the value sits.
 *
 * ⚠⚠ THE ASYMMETRY IT CLOSES IS REAL. `encodeValue`'s scalar arms return the
 * caller's value UNCHECKED while `decodeValue`'s check it (`text` is
 * `isString(value) ? value : undefined`), so without this probe aegis signs a
 * token asserting a claim its own reader reports as never stated — `region: 42`
 * from a JavaScript caller, an introspection response, or any door with no
 * declaration behind it.
 *
 * ⭐ THE CHECK IS DERIVED FROM THE DECODER, not restated beside it. Asking "would
 * the read side keep this?" by RUNNING the read side is the only formulation that
 * cannot drift; a hand-written per-kind predicate would be a third copy of codec
 * knowledge.
 *
 * ⚠ It does NOT make the member's EMPTINESS a codec question. `""` is a text
 * value, so the codec accepts it and `whenEmpty` alone decides whether it rides.
 *
 * ⚠⚠ IT IS ONLY AS STRONG AS THE DECODE ARM IT ASKS, and `bool` ANSWERS NOTHING —
 * it returns its input unchanged, so `"yes"`, `null` and `{ a: 1 }` all pass.
 * Every other arm checks: `text`/`bstr` (`isString`), `int` (`isFinite`), `date`
 * (`toDate`), `array` (its `ArrayScalar` policy, or its element walk under `of`),
 * `object` (a non-object walks to `undefined`), and both `bespoke` sub-kinds.
 * ⛔ `bool` is NOT this probe's to tighten: narrowing the decode arm changes what
 * a READ of an existing foreign token reports.
 */
const encodeIfReadable = (
  member: WalkedSpec,
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
// ⚠ It reads the BASE codec, never a per-wire override: it produces the
// jose-shaped values BOTH wires start from, and `internal/cose/cwt-spec.ts`
// applies the per-wire codec when it turns those into labels and CBOR bytes —
// which is why `bstr`, a COSE-only codec, returns the value untouched here.
//
// RECURSIVE over `{ kind: "object" }`, and the wire SELECTOR travels with the
// recursion, so a member is spelled by the wire the claim is being written for.
/**
 * ⚠ THE RECURSION, not a door. Every caller — including the drift guard — enters
 * through {@link encodeClaim}, which owns the context and the refusal; entering
 * here means inventing a context, and a walk on an invented context reports paths
 * nobody would see in production.
 */
const encodeValue = (
  spec: WalkedSpec,
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
 * The write core (domain -> wire), single-pass over the claims. A registered claim
 * maps to the selected wire NAME with its value encoded per its codec; an
 * unregistered custom claim keeps its value and flips its KEY to snake_case. The
 * VALUE encoding is identical for JOSE and COSE — only `nameOf` differs.
 *
 * EXPORTED, and the only write door: the wire is a PARAMETER, so there is no
 * `domainToCose` to keep in agreement with it. {@link domainToJose} is a one-line
 * binding of `joseName`, not a second door.
 */
export const domainToWire = (common: Dict, nameOf: NameSelector): Dict => {
  const wire: Dict = {};

  for (const [key, value] of Object.entries(common)) {
    if (value === undefined) continue;

    const spec = claimByDomain(key);
    if (spec) {
      // ⚠⚠ `null` IS NOT STATED AT THE CLAIM LEVEL TOO. Without this line the
      // structure refusal below turns `address: null` — the ordinary shape of a
      // nullable column, and the exact case the member-level ruling exists for —
      // into a THROWN error one level up from where it is omitted. Whatever the
      // answer is, it cannot be "absent inside a structure and refused at the top
      // of one".
      // ⚠ It is asked for a REGISTERED claim ONLY. An unregistered custom claim has
      // no declared shape for a value to contradict, so it is carried exactly as
      // written — the same rule `internal/claims/prune-empty-claims.ts` keeps at
      // the emission boundary.
      if (isNotStated(value)) continue;

      const encoded = encodeClaim(spec, value, nameOf);
      if (encoded !== undefined) wire[nameOf(spec)] = encoded;
    } else {
      // ⚠ SAFE ONLY BECAUSE `snakeCase` CANNOT RETURN `__proto__` (`__proto__`,
      // `__PROTO__` and `--proto--` all yield `proto`), which is what makes a plain
      // assignment admissible here where the unconverted bags need
      // `Object.fromEntries`. A key transform preserving leading underscores
      // reopens it.
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

// Dispatch ONE `bespoke` claim's value to its per-claim DOMAIN decoder — the
// read-side twin of `encodeBespoke`. Every {@link BespokeKind} is enumerated here;
// an unhandled sub-kind (a registry/translator drift) throws (the house
// exhaustive-switch idiom).
const decodeBespoke = (
  spec: WalkedSpec,
  bespoke: BespokeKind,
  value: unknown,
  context: WalkContext,
): unknown => {
  switch (bespoke) {
    case "confirmation":
      // ⚠ NO EMPTINESS VERDICT ON THIS SIDE. A read reports what a PRODUCER wrote,
      // and a `cnf: {}` on a foreign token is a statement the reader must be able
      // to see — the VERIFIER's gate is what refuses it
      // (`internal/utils/apply-verify-policy.ts`), because that refusal is about
      // the token being presented rather than about a claim being assembled.
      return walkConfirmation(value, cnfMemberByJose, (member) => member.domain, context);
    case "events":
      // The SAME guard the write arm asks, and the same refusal — a SET events map
      // is keyed by event-type URIs (RFC 8417 §2.2), which are identifiers rather
      // than field names, so the keys are carried verbatim and must NOT be
      // case-converted. See {@link eventsMap}.
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
//
// ⚠ The `default` is NOT redundant: the declared return type is `unknown`, so
// falling off the end is legal and a new {@link ArrayScalar} member would compile
// clean and DROP the claim on read. The `never` binding is what makes the
// compiler bite instead (the house exhaustive-switch idiom, as in
// `encodeBespoke`/`decodeBespoke`).
const decodeArray = (spec: WalkedSpec, scalar: ArrayScalar, value: unknown): unknown => {
  switch (scalar) {
    case "wrap":
      return toAudience(value); // RFC 7519 §4.1.3
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
// (exhaustive over ClaimCodec; an unknown kind throws). The `array` case refines
// by the codec's own scalar-tolerance policy.
//
// RECURSIVE over `{ kind: "object" }`, the mirror of `encodeValue`: the member set
// is keyed by WIRE name here and answers under its DOMAIN name, and the same wire
// selector travels down, so a COSE-keyed structure is read by the COSE spelling of
// its members and a JOSE-keyed one by the JOSE spelling.
const decodeValue = (
  spec: WalkedSpec,
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
 * `wire` is a STRANGER'S payload — a decoded token, or the dict a public door was
 * handed — and `in` walks the prototype chain, so `toString`, `constructor`,
 * `valueOf`, `hasOwnProperty` and `__proto__` are members of every object literal
 * that reaches here. The lookup would answer YES for a claim the payload does not
 * carry, and the decoder would read a FUNCTION off `Object.prototype` as its value.
 *
 * ⛔ "NO REGISTERED NAME COLLIDES WITH AN `Object.prototype` MEMBER" DOES NOT
 * COVER THIS. That is a proposition about the REGISTRY, not about this lookup, and
 * swapping `Object.hasOwn` for `in` here leaves the whole suite green. A collision
 * is also not the only way in: ANY library in the process that writes to
 * `Object.prototype` supplies one — `Object.prototype.aud = ["evil-rs"]` and a
 * token carrying no `aud` is read as stating one, an access decision handed to
 * whatever else is loaded. `translate.test.ts` drives exactly that, so the
 * MECHANISM is pinned rather than the registry's current shape.
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
 * needs every domain claim flat in one dict: a profile's `required` rules may name
 * a profile-category claim, and bucketing it away reports a present claim as
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
  // read keys unconverted (`customKey: (key) => key`) — and a plain assignment
  // makes it this bag's PROTOTYPE instead of a member.
  //
  // ⚠ THIS IS ONE OF TWO REBUILDS ON THIS PATH: `wireToFloorClaims` rebuilds the
  // same bag again to drop shadowing names, so a fix to either alone leaves the
  // door broken while this function passes.
  // pinned: translate.test.ts#carries a `__proto__` wire key as an own key.
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
  // under its wire name. The floor's caller flattens `custom` and `claims` into one
  // dict, so leaving it in lets a presenter-supplied `audience` answer for an
  // ABSENT `aud` — a token stating no audience clearing the audience floor.
  //
  // Only the RESOLVED set is filtered. A profile may require a claim under its wire
  // spelling (`introspection` requires `token_introspection`) or one the floor does
  // not resolve at all (`events`), and both must survive verbatim.
  //
  // ⛔ `Object.fromEntries`, for the same reason the bag was built with it: a
  // SECOND rebuild over the same wire-controlled keys, keyed unconverted, so an
  // assignment makes `__proto__` this bag's prototype and DROPS the member. ⚠ The
  // cost is a FLOOR JUDGEMENT ON CLAIMS THE TOKEN DID NOT PRESENT — this bag is
  // spread into `enforceVerifyFloor`'s payload (`internal/utils/verify-token.ts`),
  // so a dropped claim is one a `forbidden` rule no longer sees and a `required`
  // rule reports missing. It reaches no caller, so the cost is the verdict.
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
