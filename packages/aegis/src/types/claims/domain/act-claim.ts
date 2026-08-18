import type { Dict } from "@lindorm/types";

// Public, camelCase representation of the RFC 8693 `act` / `may_act` claim.
// Used by SignJwtContent, ParsedJwtPayload, and TokenDelegation.
//
// The wire counterpart is `ActClaimWire` (`../wire/act-claim-wire.ts`). ⚠ The
// note that used to sit here said it was "consumed only by the wire<->public
// mapping layer in jwt-payload.ts", and BOTH halves were wrong: the path was
// `./jwt/...`, which has never existed, and `internal/utils/jwt-payload.ts`
// exports a pure decoder that holds no claim mapping at all.
//
// ⚠⚠ THE MEMBER SET IS OPEN, AND THE RFC IS WHY. RFC 8693 §4.1: "The 'act' claim
// value is a JSON object, and members in the JSON object are claims that identify
// the actor." §4.4 names one outright — "the combination of the two claims 'iss'
// and 'sub' are sometimes necessary to uniquely identify an authorized actor,
// while the 'email' claim might be used to provide additional useful information
// about that party." So a conformant issuer may write a member aegis does not
// declare, and refusing such a token is the worse fault. The claim registry
// declares the five below and carries anything else VERBATIM
// (`internal/claims/act-members.ts`) — verbatim rather than case-flipped, because
// a tail member is another specification's JWT claim name and a flip would
// rewrite it.
//
// ⚠ ONE THING IS STILL REFUSED: a tail member whose key COLLIDES with a declared
// member's resolved key — `{ sub: "audited", subject: "rogue" }`. Both resolve to
// `subject`, and silently letting the last one win would hand actor
// identification to whoever wrote the token. See
// `internal/claims/translate.ts#claim_member_collision`.

/**
 * The five members aegis DECLARES, split out from the open type on purpose.
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
  audience?: Array<string>;
  clientId?: string;
  act?: ActClaim;
};

// https://datatracker.ietf.org/doc/html/rfc8693#section-4.1
export type ActClaim = ActClaimMembers & Dict;
