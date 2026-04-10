// Wire-format (snake_case) keys that belong to AegisProfile.
// Used by parseTokenPayload to partition incoming claim fields into
// `profile` (known AegisProfile fields) vs. `claims` (truly custom claims).
//
// Derived manually from src/types/jwt/aegis-profile.ts. Keep in sync.
// Aegis-owned claims that have their own first-class fields on the payload
// (sub, permissions, roles, etc.) are intentionally NOT listed here.
export const AEGIS_PROFILE_WIRE_KEYS: ReadonlySet<string> = new Set([
  // address (OIDC Core §5.1 — nested object, inner keys handled by camelKeys recursion)
  "address",

  // contact (OIDC Core §5.1)
  "email",
  "email_verified",
  "phone_number",
  "phone_number_verified",

  // visual (OIDC Core §5.1)
  "picture",

  // personal — OIDC Core §5.1
  "birthdate",
  "family_name",
  "gender",
  "given_name",
  "locale",
  "middle_name",
  "name",
  "nickname",
  "preferred_username",
  "profile",
  "updated_at",
  "website",
  "zoneinfo",

  // personal — lindorm extensions
  "display_name",
  "honorific",
  "legal_name",
  "legal_name_verified",
  "naming_system",
  "preferred_accessibility",
  "preferred_name",
  "pronouns",

  // contact card — work / professional context
  "department",
  "job_title",
  "occupation",
  "organization",
]);
