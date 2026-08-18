import type { Dict } from "@lindorm/types";

/**
 * RFC 9493 — Subject Identifiers for Security Event Tokens. The `sub_id`
 * claim is an object with a `format` member plus the members that format
 * requires. We model the formats the platform emits/accepts; an unknown
 * format is permitted structurally (any-string `format`) but carries no
 * required-member set, so the shape rule only enforces `format` itself.
 *
 * https://www.rfc-editor.org/rfc/rfc9493
 */
export type SubjectIdentifierFormat =
  | "account"
  | "email"
  | "iss_sub"
  | "opaque"
  | "phone_number"
  | "did"
  | "uri"
  | "aliases"
  | (string & {});

/**
 * The nine members aegis DECLARES, split out from the open type on purpose —
 * exactly the split `ActClaimMembers` / `ActClaim` makes, and for the same
 * reason.
 *
 * ⭐ IT IS WHAT KEEPS THE DELETION PATH CLOSED. `claims-registry.test.ts` freezes
 * every declared member's cells in a `Record<keyof SubjectIdentifierMembers, …>`,
 * so a registry declaration and its frozen row cannot be removed together.
 * `keyof (X & Dict)` is `string`, so naming the members inside the open type
 * would have evaporated that binding silently.
 *
 * ⚠ THE SPELLINGS ARE THE HOUSE VOCABULARY: `phoneNumber`, not the wire's
 * `phone_number`. `iss` and `sub` are their own domain names — see
 * `internal/claims/sub-id-members.ts` for why they are not `issuer`/`subject`.
 */
export type SubjectIdentifierMembers = {
  format: SubjectIdentifierFormat;
  iss?: string;
  sub?: string;
  email?: string;
  phoneNumber?: string;
  uri?: string;
  url?: string;
  id?: string;
  identifiers?: Array<SubjectIdentifier>;
};

/**
 * ⚠ OPEN BY CONSTRUCTION (`& Dict`), and the registry says the same thing in the
 * cell that decides behaviour: `internal/claims/sub-id-members.ts` declares the
 * nine members above with `open: "verbatim"`. RFC 9493 §3 permits an Identifier
 * Format named by "a Collision-Resistant Name as defined in [RFC7519]" — no
 * registration required — so a conformant Subject Identifier can carry members
 * this package cannot enumerate, and they travel under the producer's own
 * spelling.
 */
export type SubjectIdentifier = SubjectIdentifierMembers & Dict;

/**
 * The members each known `format` requires (beyond `format` itself), per
 * RFC 9493 §3.2. Formats absent from this map are accepted with no extra
 * required members.
 *
 * ⚠⚠ KEYED BY THE MEMBER'S **DOMAIN** NAME — `phoneNumber`, not `phone_number`.
 * Its only reader is `internal/utils/rules/sub-id-shape.ts`, which reads
 * `claims.subjectId`: a DOMAIN-keyed bag. While the `sub_id` translator carried
 * its value verbatim the two spellings were the same string and nothing had to
 * choose; `internal/claims/sub-id-members.ts` declares the member set now, so
 * `phone_number` here would look up a key the domain bag does not have and the
 * Phone Number format's REQUIRED member would go silently unenforced.
 *
 * ⚠ IT IS A CONDITIONAL AND STAYS OUT OF THE MEMBER SET. `format: "email"` ⇒
 * `email` is required; `format: "opaque"` ⇒ it is not.
 * {@link ClaimMemberSpec.required} is UNCONDITIONAL by design (the walker asks it
 * of every structure the claim appears in, in both directions), so the two are
 * different facts and the member set holds only the unconditional one — `format`
 * itself, which RFC 9493 §3 demands of every Subject Identifier whatever its
 * format is.
 *
 * ⚠ ONE MEMBER SERVES TWO FORMATS (`uri`, for both Account and URI), which is a
 * second reason this cannot fold into the member set: a member declaration is
 * per member, and the demand is per format.
 *
 * ⛔⛔ A `Map`, NEVER AN OBJECT LITERAL, BECAUSE THE KEY IS A PRODUCER'S STRING.
 * The format name is whatever a caller or a token wrote — RFC 9493 §3 lets an
 * Identifier Format be named by "a Collision-Resistant Name as defined in
 * [RFC7519]", so it is unconstrained text — and an object literal resolves
 * `constructor` / `toString` / `valueOf` / `hasOwnProperty` through
 * `Object.prototype`. As a literal, `TABLE[format] ?? []` returned the `Object`
 * CONSTRUCTOR for `format: "constructor"`, so the `?? []` never fired and the
 * `for…of` over it threw a bare `TypeError` — escaping the package's
 * `AegisDomainError` contract entirely. Measured through the public doors:
 *   - `aegis.mint("security_event", { subjectId: { format: "constructor", … } })`
 *     -> `TypeError: required is not iterable`. Same for `toString`, `valueOf`
 *     and `hasOwnProperty`; `format: "opaque"` mints fine.
 *   - `aegis.verify("security_event", <a SIGNATURE-VALID token whose sub_id.format
 *     is "constructor">)` -> the same `TypeError`, from
 *     `internal/utils/enforce-verify-floor.ts`'s `enforcePolicy` call.
 * ⚠ The verify half needs a VALID SIGNATURE: `internal/utils/verify-token.ts`
 * checks the signature (`wire.verifyClaims`) before it reaches the floor, and
 * `aegis.parse` — the unauthenticated door — runs no profile policy at all. So it
 * is a trusted-issuer crash, not an unauthenticated one.
 * ⇒ A `Map` rather than `Object.hasOwn` because a `Map` cannot be reached through
 * a prototype AT ALL — the same argument `walkObject` already makes for its own
 * member lookup (`internal/claims/translate.ts`).
 */
export const SUBJECT_IDENTIFIER_REQUIRED_MEMBERS: ReadonlyMap<
  string,
  ReadonlyArray<string>
> = new Map([
  ["account", ["uri"]],
  ["email", ["email"]],
  ["iss_sub", ["iss", "sub"]],
  ["opaque", ["id"]],
  ["phone_number", ["phoneNumber"]],
  ["did", ["url"]],
  ["uri", ["uri"]],
  ["aliases", ["identifiers"]],
]);
