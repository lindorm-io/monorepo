import type { ClaimMemberSpec } from "../registry/claim-spec.js";
import type { Wire } from "../registry/wire.js";
import { type WireKey, wireLabel, wireName } from "../registry/wire-key.js";

/**
 * The members of the RFC 8693 §4.1 actor claim — shared by `act` and `may_act`.
 * §4.4 describes `may_act` in the words §4.1 uses for `act` ("The claim value is a
 * JSON object, and members in the JSON object are claims that identify the party
 * that is asserted as being eligible to act for the party identified by the JWT
 * containing the claim"), so the two have always been one shape.
 *
 * ⭐ THIS IS THE RECURSIVE MEMBER SET, and it is the reason
 * {@link ObjectCodec.children} is a THUNK rather than an array. RFC 8693 §4.1:
 * "A chain of delegation can be expressed by nesting one 'act' claim within
 * another. The outermost 'act' claim represents the current actor while nested
 * 'act' claims represent prior actors." The declaration below therefore names
 * ITSELF as a member's member set, which a direct array cannot express in
 * TypeScript without a mutable binding. Everything that walks a member set — the
 * translator, the CWT byte shaper, the registry's own sample checker — keys its
 * visited set on that thunk, which is stable where the array it returns is not.
 *
 * ⚠⚠ THE MEMBER SET IS OPEN, BECAUSE RFC 8693 SAYS IT IS. §4.1: "The 'act' claim
 * value is a JSON object, and members in the JSON object are claims that identify
 * the actor. The claims that make up the 'act' claim identify and possibly
 * provide additional information about the actor." §4.4 NAMES one outside these
 * five: "the combination of the two claims 'iss' and 'sub' are sometimes
 * necessary to uniquely identify an authorized actor, while the 'email' claim
 * might be used to provide additional useful information about that party."
 *
 * ⚠ IT WAS CLOSED FOR ONE STEP, and the reasoning was not silly — aegis already
 * refused an undeclared actor member at mint (`act-chain-shape.ts`), the public
 * `ActClaim` named exactly five, and the read side's existing behaviour was a
 * SILENT DROP rather than a carry. It was reversed because refusing a conformant
 * foreign token is the worse of the two faults: an issuer following the RFC's own
 * example becomes unreadable, and the deployment's remedy is to stop using the
 * domain verbs entirely.
 *
 * ⛔ OPENING IT WAS ONLY SAFE ONCE THE COLLISION REFUSAL EXISTED, and the order
 * matters. An open tail writes into the same bag as the declared members, so a
 * verbatim `subject` beside a declared `sub` — which also resolves to `subject` —
 * would have been resolved by KEY ORDER, handing actor identification to whoever
 * wrote the token. `internal/claims/translate.ts` refuses that collision outright.
 * Measured on the real `address` declaration before the fix:
 * `Aegis.toDomain({ address: { street_address: "DECLARED", streetAddress: "SHADOW" } })`
 * → `{ streetAddress: "SHADOW" }`.
 *
 * ⚠ `"verbatim"`, NOT `"flip"`. A tail member is another specification's JWT
 * claim name — §4.4's own example is `email` — so the house snake_case flip would
 * not translate it but rewrite it into a field nobody is looking for. That is the
 * same reason RFC 9396's authorization-details elements carry a verbatim tail.
 *
 * ⚠ `audience` IS DECLARED, AND RFC 8693 §4.1 SAYS IT SHOULD NOT BE THERE:
 * "non-identity claims (e.g., 'exp', 'nbf', and 'aud') are not meaningful when
 * used within an 'act' claim and are therefore not used." The member is declared
 * because it is what aegis emits TODAY — the public `ActClaim.audience` maps to
 * `aud` and the COSE compact form gives it label 3 — and a migration that
 * silently changed what reaches a signed wire would be indistinguishable from a
 * defect in the migration. Removing it is a public-surface change with its own
 * decision to make, and it is filed rather than smuggled in here.
 */

/**
 * How an actor member is keyed on each wire.
 *
 * JOSE spells the member by its RFC 8693 name. COSE keys it by an INTEGER label,
 * with that same name as the interoperable string fallback — which is what makes
 * the compact and interoperable COSE forms two renderings of one declaration
 * rather than two tables that can disagree.
 *
 * ⚠ THE LABELS ARE ONLY PARTLY REGISTERED. RFC 8392 §4 assigns `iss` 1, `sub` 2
 * and `aud` 3, and those three are reused here so the compact actor map speaks
 * the CWT vocabulary. `client_id` (4) and the nested `act` (5) have no COSE
 * registration at all and are LINDORM's own, meaningful only to a verifier
 * holding this registry — which is exactly why they ride only in the proprietary
 * encoding and degrade to their string names otherwise.
 */
const actorMember = (name: string, label: number): Record<Wire, WireKey> => ({
  jose: wireName(name),
  cose: wireLabel(label, name),
});

/**
 * Every member is `whenEmpty: "keep"`.
 *
 * ⚠ It is the verdict that reproduces the hand-written builder EXACTLY. That
 * builder was `omitUndefined({ sub, iss, aud, client_id, act })`, which drops
 * `undefined` and NOTHING else — so an actor stating `sub: ""` reached the wire
 * with it. `"keep"` is what the walker does with an empty member, and choosing
 * `"prune"` here would change what a signed token says while every round trip
 * through this package still agreed with itself.
 */
const KEEP = "keep" as const;

export const ACT_MEMBERS: ReadonlyArray<ClaimMemberSpec> = [
  {
    domain: "issuer",
    wire: actorMember("iss", 1),
    codec: { kind: "text" },
    whenEmpty: KEEP,
    sample: "https://actor.lindorm.test",
  },
  {
    domain: "subject",
    wire: actorMember("sub", 2),
    codec: { kind: "text" },
    whenEmpty: KEEP,
    sample: "actor_sample",
  },
  {
    // RFC 7519 §4.1.3 defines `aud` as string-OR-array, so a scalar WRAPS rather
    // than being refused — the same tolerance the top-level `audience` claim
    // declares, stated by the same cell instead of by a second rule.
    domain: "audience",
    wire: actorMember("aud", 3),
    codec: { kind: "array", scalar: "wrap" },
    whenEmpty: KEEP,
    sample: ["https://rs.lindorm.test"],
  },
  {
    domain: "clientId",
    wire: actorMember("client_id", 4),
    codec: { kind: "text" },
    whenEmpty: KEEP,
    sample: "actor_client_sample",
  },
  {
    // ⭐ THE SELF-REFERENCE. See the file docstring: this is the whole reason the
    // registry's member sets are thunks.
    domain: "act",
    wire: actorMember("act", 5),
    // ⚠⚠ `open` IS DECLARED HERE TOO, AND OMITTING IT WAS A LIVE DEFECT FOR THE
    // LENGTH OF ONE MEASUREMENT. `open` sits on the CODEC, and a nested member
    // declares its own — so setting it on the two claim entries alone left the
    // actor set OPEN at depth 1 and CLOSED at every depth below. Measured through
    // the public mint door: `act: { subject: "s", email: "e" }` minted, while
    // `act: { subject: "s", act: { subject: "s2", surprise: true } }` was refused
    // with `act.act.surprise`. RFC 8693 §4.1 makes a nested `act` the SAME kind of
    // object as the outer one — "A chain of delegation can be expressed by nesting
    // one 'act' claim within another" — so a rule that changes with depth is a
    // rule about nothing.
    codec: { kind: "object", children: () => ACT_MEMBERS, open: "verbatim" },
    whenEmpty: KEEP,
    // A PRIOR actor, one hop back — hand-written and deliberately shallow,
    // because the sample is the one place a self-referential declaration has to
    // stop. The generated conformance matrix round-trips the claim sample
    // derived below, so this cell is what makes that round trip a DEPTH-2 one.
    sample: { subject: "prior_actor_sample" },
  },
];

/**
 * The `act`/`may_act` claim sample, DERIVED from the members — the same
 * derivation `address-members.ts` performs, and for the same reason: it is what
 * gives every member's own `sample` a consumer, by putting each one through a
 * real mint and a real verify in the generated spec matrix.
 */
export const ACT_SAMPLE: Readonly<Record<string, unknown>> = Object.fromEntries(
  ACT_MEMBERS.map((member) => [member.domain, member.sample]),
);
