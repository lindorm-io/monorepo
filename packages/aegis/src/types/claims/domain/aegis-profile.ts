// Aegis-owned profile claims. Inspired by the standard OIDC Core §5.1
// profile claims (given_name, family_name, email, etc.) but extended with
// Lindorm-specific personalization and contact-card fields. Aegis owns
// this type fully; `Claims` from @lindorm/openid remains as a pure standards
// reference for the unmodified OIDC Core spec.
//
// Scope: AegisProfile contains claims that are appropriate for inclusion
// in ID tokens for user personalization and contact-card-style display.
// Deliberately excluded:
//   - ephemeral state (active/suspended) — use a live endpoint
//   - external resource lists (social networks, IM handles, linked IdPs)
//     — belong in a /me/* endpoint, not a token snapshot
//   - highly sensitive regulated PII (SSN, national identity numbers)
//     — see AegisSensitive, whose fields travel as FLAT individual claims
//       that the read side surfaces only from an encrypted token (jwe/cwe),
//       suppressing them otherwise (the aegis confidentiality gate)
//   - dynamic fields (geo location) — use fresh endpoints
//   - redundancies with OIDC Core claims (language vs locale, timeZone
//     vs zoneinfo, gravatarUri/avatarUri vs picture)
//
// ⚠ `username` is NOT the redundancy it looks like. `username` is a claim ABOUT a
// token (a registered `OAuthClaims` member, `bucket: "claims"` — RFC 7662 §2.2);
// `preferred_username` is an identity field of the PROFILE (OIDC Core §5.1). Both
// are registered, both round-trip, and neither shadows the other — the split
// matters because the profile bucket is dropped from an introspection answer and
// kept off the resolved access credential, while `username` is not.
//
// Aegis top-level claims (sub, permissions, roles, etc.) are NOT part of
// AegisProfile — they have first-class fields on SignJwtContent.

export type AegisProfileAddress = {
  careOf?: string | null;
  country?: string | null;
  formatted?: string | null;
  locality?: string | null;
  postalCode?: string | null;
  region?: string | null;
  streetAddress?: string | null;
};

export type AegisProfileNamingSystem = "given_family" | "family_given";

export type AegisProfile = {
  // address (OIDC Core §5.1)
  address?: AegisProfileAddress;

  // contact (OIDC Core §5.1)
  email?: string | null;
  emailVerified?: boolean;
  phoneNumber?: string | null;
  phoneNumberVerified?: boolean;

  // visual (OIDC Core §5.1)
  picture?: string | null;

  // personal — OIDC Core §5.1
  birthdate?: string | null;
  familyName?: string | null;
  gender?: string | null;
  givenName?: string | null;
  locale?: string | null;
  middleName?: string | null;
  name?: string | null;
  nickname?: string | null;
  preferredUsername?: string | null;
  profile?: string | null;
  // OIDC Core §5.1 `updated_at` is a NumericDate. Like every other date-valued
  // claim the DOMAIN form is a `Date` and the WIRE form carries the unix
  // seconds — that split is what the domain/wire type pair exists for.
  updatedAt?: Date;
  website?: string | null;
  zoneinfo?: string | null;

  // personal — lindorm extensions
  displayName?: string | null;
  honorific?: string | null;
  legalName?: string | null;
  legalNameVerified?: boolean;
  namingSystem?: AegisProfileNamingSystem | null;
  preferredAccessibility?: Array<string>;
  preferredName?: string | null;
  pronouns?: string | null;

  // contact card — work / professional context
  department?: string | null;
  jobTitle?: string | null;
  occupation?: string | null;
  organization?: string | null;
};
