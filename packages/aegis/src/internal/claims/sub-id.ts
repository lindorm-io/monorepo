import type { Dict } from "@lindorm/types";

/**
 * The RFC 9493 §3.2 Identifier Formats aegis names. The union stays OPEN: an
 * unknown format is structurally permitted and carries no required-member set, so
 * `internal/utils/rules/sub-id-shape.ts` then enforces `format` alone.
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
 * The members aegis DECLARES, split out from the open type on purpose — the same
 * split `ActClaimMembers` / `ActClaim` makes.
 *
 * ⭐ IT IS WHAT KEEPS THE DELETION PATH CLOSED. `claims-registry.test.ts` freezes
 * every declared member's cells in a `Record<keyof SubjectIdentifierMembers, …>`,
 * so a registry declaration and its frozen row cannot be removed together.
 * `keyof (X & Dict)` is `string`, so naming the members inside the open type
 * would evaporate that binding silently.
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
 * ⚠ OPEN BY CONSTRUCTION (`& Dict`), matching the cell that decides behaviour:
 * `internal/claims/sub-id-members.ts` declares the members above with
 * `open: "verbatim"` (RFC 9493 §3), so an undeclared member travels under the
 * producer's own spelling.
 */
export type SubjectIdentifier = SubjectIdentifierMembers & Dict;

/**
 * The members each known `format` requires beyond `format` itself (RFC 9493 §3.2).
 * A format absent from this map is accepted with no extra required members.
 *
 * ⚠⚠ KEYED BY THE MEMBER'S **DOMAIN** NAME — `phoneNumber`, not `phone_number`.
 * Its only reader is `internal/utils/rules/sub-id-shape.ts`, which reads
 * `claims.subjectId`: a DOMAIN-keyed bag. A wire spelling here looks up a key that
 * bag does not have, and the format's REQUIRED member goes silently unenforced.
 *
 * ⚠ IT IS A CONDITIONAL AND STAYS OUT OF THE MEMBER SET.
 * {@link ClaimMemberSpec.required} is UNCONDITIONAL by design — the walker asks it
 * of every structure the claim appears in, in both directions — so the member set
 * holds only `format` itself. One member also serves TWO formats (`uri`, for
 * Account and URI), where a member declaration is per member.
 *
 * ⛔⛔ A `Map`, NEVER AN OBJECT LITERAL, BECAUSE THE KEY IS A PRODUCER'S STRING
 * (RFC 9493 §3). As a literal, `TABLE[format] ?? []` resolves `constructor` /
 * `toString` / `valueOf` / `hasOwnProperty` through `Object.prototype`, so the
 * `?? []` never fires and the `for…of` over it throws a bare `TypeError` —
 * escaping the package's `AegisDomainError` contract. A `Map` cannot be reached
 * through a prototype at all, which is the argument `walkObject` already makes
 * for its own member lookup (`internal/claims/translate.ts`).
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
