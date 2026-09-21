import type { Dict } from "@lindorm/types";

// Public, camelCase representation of the RFC 8693 `act` / `may_act` claim.
// Used by SignJwtContent and TokenDelegation.
//
// The wire counterpart is `ActClaimWire` (`../wire/act-claim-wire.ts`).
//
// ⚠⚠ THE MEMBER SET IS OPEN: a conformant issuer may write a member aegis does
// not declare (RFC 8693 §4.1, RFC 8693 §4.4), and refusing such a token is the
// worse fault. The claim registry declares the four below and carries anything
// else VERBATIM
// (`internal/claims/act-members.ts`) — verbatim rather than case-flipped, because
// a tail member is another specification's JWT claim name and a flip would
// rewrite it.
//
// ⚠ ONE THING IS STILL REFUSED: a tail member whose key COLLIDES with a declared
// member's resolved key — `{ sub: "audited", subject: "rogue" }`. Both resolve to
// `subject`, and silently letting the last one win would hand actor
// identification to whoever wrote the token. Refused by `reportCollision` in
// `internal/claims/translate.ts`.

/**
 * The four members aegis DECLARES, split out from the open type on purpose.
 *
 * ⭐ IT IS WHAT KEEPS THE DELETION PATH CLOSED. `internal/claims/claims-registry.test.ts`
 * freezes every declared member's cells in a `Record<keyof ActClaimMembers, …>`,
 * so a registry declaration and its frozen row cannot be removed together — the
 * row cannot go while this type still names the member. `keyof (X & Dict)` is
 * `string`, so widening the type in place would have evaporated that binding
 * silently, exactly as it already has for `AuthorizationDetail`.
 */
export type ActClaimMembers = {
  subject?: string;
  issuer?: string;
  clientId?: string;
  act?: ActClaim;
};

/**
 * ⛔ `audience` IS TYPED `never`, AT EVERY DEPTH: aegis declares no audience
 * member inside an actor claim and emits none — AEGIS POLICY AT THE MINT DOOR,
 * RFC 8693 §4.1. The nesting follows from `ActClaimMembers.act` naming this type,
 * so the rule does not change with depth.
 *
 * ⚠ IT BINDS THE WRITE DOOR ALONE. A caller reaching past the type rides the open
 * tail like any undeclared member, and a foreign actor's own `aud` is reported in
 * that tail untranslated at VERIFY — neither refused nor renamed.
 * pinned: `interfaces/aegis/Aegis.test.ts`, `__features__/Aegis.delegation.feature`.
 */
// https://datatracker.ietf.org/doc/html/rfc8693#section-4.1
export type ActClaim = ActClaimMembers & Dict & { audience?: never };
