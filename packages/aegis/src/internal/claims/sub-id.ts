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

export type SubjectIdentifier = {
  format: SubjectIdentifierFormat;
} & Dict;

/**
 * The members each known `format` requires (beyond `format` itself), per
 * RFC 9493 §3. Formats absent from this map are accepted with no extra
 * required members.
 */
export const SUBJECT_IDENTIFIER_REQUIRED_MEMBERS: Record<string, Array<string>> = {
  account: ["uri"],
  email: ["email"],
  iss_sub: ["iss", "sub"],
  opaque: ["id"],
  phone_number: ["phone_number"],
  did: ["url"],
  uri: ["uri"],
  aliases: ["identifiers"],
};
