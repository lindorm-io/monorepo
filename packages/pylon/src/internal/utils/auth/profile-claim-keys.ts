// camelCase domain names of the AegisProfile fields (@lindorm/aegis). The claim
// translator (Aegis.toDomain) surfaces these as first-class domain claims; the
// userinfo parser keeps ONLY these (the profile is the userinfo response), and
// the introspection parser drops them (an introspection response is not a
// profile). Mirror of the AegisProfile shape — keep in sync if that type gains
// or loses a field.
export const PROFILE_CLAIM_KEYS: ReadonlySet<string> = new Set([
  // address (OIDC Core §5.1 — nested object)
  "address",

  // contact (OIDC Core §5.1)
  "email",
  "emailVerified",
  "phoneNumber",
  "phoneNumberVerified",

  // visual (OIDC Core §5.1)
  "picture",

  // personal — OIDC Core §5.1
  "birthdate",
  "familyName",
  "gender",
  "givenName",
  "locale",
  "middleName",
  "name",
  "nickname",
  "preferredUsername",
  "profile",
  "updatedAt",
  "website",
  "zoneinfo",

  // personal — lindorm extensions
  "displayName",
  "honorific",
  "legalName",
  "legalNameVerified",
  "namingSystem",
  "preferredAccessibility",
  "preferredName",
  "pronouns",

  // contact card — work / professional context
  "department",
  "jobTitle",
  "occupation",
  "organization",
]);
