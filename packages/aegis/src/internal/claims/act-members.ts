import type { ClaimMemberSpec } from "../registry/claim-spec.js";
import type { Wire } from "../registry/wire.js";
import { type WireKey, wireLabel, wireName } from "../registry/wire-key.js";

/**
 * The members of the RFC 8693 §4.1 actor claim — one shape, shared by `act` and
 * `may_act` (RFC 8693 §4.4).
 *
 * ⭐ THIS IS THE RECURSIVE MEMBER SET, and it is the reason
 * {@link ObjectCodec.children} is a THUNK rather than an array: the declaration
 * below names ITSELF as a member's member set, which a direct array cannot
 * express without a mutable binding. Every walker — the translator, the CWT byte
 * shaper, the registry's sample checker — keys its visited set on that thunk,
 * which is stable where the array it returns is not.
 *
 * ⚠⚠ THE MEMBER SET IS OPEN (RFC 8693 §4.1, RFC 8693 §4.4), so the five below are not an
 * allowlist and a conformant foreign token stays readable.
 *
 * ⛔ OPENING IT IS ONLY SAFE BECAUSE THE COLLISION REFUSAL EXISTS. An open tail
 * writes into the same bag as the declared members, so a verbatim `subject`
 * beside a declared `sub` — which also resolves to `subject` — would be settled
 * by KEY ORDER, handing actor identification to whoever wrote the token.
 * `internal/claims/translate.ts` refuses that collision outright.
 *
 * ⚠ `"verbatim"`, NOT `"flip"`: a tail member is another specification's JWT
 * claim name, so the house snake_case flip would rewrite it into a field nobody
 * is looking for. RFC 9396 authorization-details elements carry a verbatim tail
 * for the same reason.
 *
 * ⚠ `audience` IS DECLARED THOUGH RFC 8693 §4.1 EXCLUDES IT — because it is what
 * aegis emits: the public `ActClaim.audience` maps to `aud` and the COSE compact
 * form gives it label 3. Removing it is a public-surface change with its own
 * decision to make.
 */

/**
 * How an actor member is keyed on each wire: the RFC 8693 name on JOSE, an
 * INTEGER label on COSE with that same name as the interoperable string fallback
 * — so the compact and interoperable COSE forms are two renderings of ONE
 * declaration rather than two tables that can disagree.
 *
 * ⚠ THE LABELS ARE ONLY PARTLY REGISTERED. 1/2/3 are RFC 8392 §4's, reused so the
 * compact actor map speaks the CWT vocabulary; `client_id` (4) and the nested
 * `act` (5) are LINDORM's own, meaningful only to a verifier holding this
 * registry, which is why they ride in the proprietary encoding alone.
 */
const actorMember = (name: string, label: number): Record<Wire, WireKey> => ({
  jose: wireName(name),
  cose: wireLabel(label, name),
});

/**
 * Every member is `whenEmpty: "keep"` — an actor stating `sub: ""` rides with it.
 *
 * ⚠ Flipping any of these to `"prune"` changes what a SIGNED token says while
 * every round trip through this package still agrees with itself; the frozen
 * member table in `claims-registry.test.ts` is the one thing that pins the cells.
 */
const KEEP = "keep" as const;

export const ACT_MEMBERS: ReadonlyArray<ClaimMemberSpec> = [
  {
    domain: "issuer",
    spec: {
      kind: "rfc",
      rfc: "RFC 8693",
      section: "4.1",
      url: "https://www.rfc-editor.org/rfc/rfc8693#section-4.1",
    },
    wire: actorMember("iss", 1),
    codec: { kind: "text" },
    whenEmpty: KEEP,
    sample: "https://actor.lindorm.test",
  },
  {
    domain: "subject",
    spec: {
      kind: "rfc",
      rfc: "RFC 8693",
      section: "4.1",
      url: "https://www.rfc-editor.org/rfc/rfc8693#section-4.1",
    },
    wire: actorMember("sub", 2),
    codec: { kind: "text" },
    whenEmpty: KEEP,
    sample: "actor_sample",
  },
  {
    // RFC 7519 §4.1.3 — a scalar WRAPS rather than being refused, the same
    // tolerance the top-level `audience` claim declares, stated by the same cell
    // instead of by a second rule.
    domain: "audience",
    spec: {
      kind: "policy",
      why: "aegis carries `aud` inside `act` for public-surface compatibility with the top-level audience claim, and the codec wraps a scalar rather than refusing it. RFC 8693 §4.1.",
    },
    wire: actorMember("aud", 3),
    codec: { kind: "array", scalar: "wrap" },
    whenEmpty: KEEP,
    sample: ["https://rs.lindorm.test"],
  },
  {
    domain: "clientId",
    spec: {
      kind: "rfc",
      rfc: "RFC 8693",
      section: "4.3",
      url: "https://www.rfc-editor.org/rfc/rfc8693#section-4.3",
    },
    wire: actorMember("client_id", 4),
    codec: { kind: "text" },
    whenEmpty: KEEP,
    sample: "actor_client_sample",
  },
  {
    // ⭐ THE SELF-REFERENCE — see the file docstring.
    domain: "act",
    spec: {
      kind: "rfc",
      rfc: "RFC 8693",
      section: "4.1",
      url: "https://www.rfc-editor.org/rfc/rfc8693#section-4.1",
    },
    wire: actorMember("act", 5),
    // ⚠⚠ `open` IS DECLARED HERE TOO, AND OMITTING IT IS A LIVE DEFECT. `open`
    // sits on the CODEC and a nested member declares its own, so setting it on the
    // two claim entries alone leaves the actor set OPEN at depth 1 and CLOSED at
    // every depth below. A nested `act` is the same kind of object as the outer
    // one (RFC 8693 §4.1), so a rule that changes with depth is a rule about
    // nothing.
    codec: { kind: "object", children: () => ACT_MEMBERS, open: "verbatim" },
    whenEmpty: KEEP,
    // A PRIOR actor, one hop back — hand-written and deliberately shallow,
    // because the sample is the one place a self-referential declaration has to
    // stop. It is what makes the generated matrix's round trip a DEPTH-2 one.
    sample: { subject: "prior_actor_sample" },
  },
];

/**
 * The `act`/`may_act` claim sample, DERIVED from the members — what gives every
 * member's own `sample` a consumer, by putting each one through a real mint and a
 * real verify in the generated spec matrix.
 */
export const ACT_SAMPLE: Readonly<Record<string, unknown>> = Object.fromEntries(
  ACT_MEMBERS.map((member) => [member.domain, member.sample]),
);
