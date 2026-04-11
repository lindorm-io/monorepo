// Aegis-owned profile claims. Inspired by the standard OIDC Core §5.1
// profile claims (given_name, family_name, email, etc.) but extended with
// Lindorm-specific personalization and contact-card fields. Aegis owns
// this type fully; @lindorm/types/OpenIdClaims remains as a pure standards
// reference for the unmodified OIDC Core spec.
//
// Scope: AegisProfile contains claims that are appropriate for inclusion
// in ID tokens for user personalization and contact-card-style display.
// Deliberately excluded:
//   - ephemeral state (active/suspended) — use a live endpoint
//   - external resource lists (social networks, IM handles, linked IdPs)
//     — belong in a /me/* endpoint, not a token snapshot
//   - highly sensitive regulated PII (SSN, national identity numbers)
//     — require encrypted transport and separate typed claims
//   - dynamic fields (geo location) — use fresh endpoints
//   - redundancies with OIDC Core claims (language vs locale, timeZone
//     vs zoneinfo, username vs preferred_username, gravatarUri/avatarUri
//     vs picture)
//
// Aegis top-level claims (sub, permissions, roles, etc.) are NOT part of
// AegisProfile — they have first-class fields on SignJwtContent /
// ParsedJwtPayload.

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
  updatedAt?: number;
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
