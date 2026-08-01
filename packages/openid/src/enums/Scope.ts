/**
 * LINDORM EXTENSION scopes — the scope values lindorm adds on top of the
 * standard OIDC set. Each one gates a group of lindorm claims (see `Claims`).
 */
export const LindormScope = {
  /** wire: `accessibility` — gates `preferredAccessibility` */
  Accessibility: "accessibility",
  /** wire: `auth` — gates `permissions` / `roles` */
  Auth: "auth",
  /** wire: `geo_location` — gates `geoLocation` */
  GeoLocation: "geo_location",
  /** wire: `identity_providers` — gates `identityProviders` */
  IdentityProviders: "identity_providers",
  /** wire: `instant_messaging` — gates `instantMessaging` */
  InstantMessaging: "instant_messaging",
  /** wire: `legal` — gates `legalName` / `legalNameVerified` */
  Legal: "legal",
  /** wire: `national_identity_number` — gates `nationalIdentityNumber*` */
  NationalIdentityNumber: "national_identity_number",
  /** wire: `social_networks` — gates `socialNetworks` */
  SocialNetworks: "social_networks",
  /** wire: `social_security_number` — gates `socialSecurityNumber*` */
  SocialSecurityNumber: "social_security_number",
  /** wire: `work_profile` — gates `department` / `jobTitle` / `occupation` / `organization` */
  WorkProfile: "work_profile",
} as const;

/**
 * The RFC-standard scope values: OIDC Core §5.4 (openid, profile, email,
 * address, phone) + OIDC Core §11 (offline_access).
 */
export const StandardScope = {
  /** wire: `address` — OIDC Core §5.4 */
  Address: "address",
  /** wire: `email` — OIDC Core §5.4 */
  Email: "email",
  /** wire: `offline_access` — OIDC Core §11 */
  OfflineAccess: "offline_access",
  /** wire: `openid` — OIDC Core §3.1.2.1; REQUIRED for an OIDC request */
  OpenId: "openid",
  /** wire: `phone` — OIDC Core §5.4 */
  Phone: "phone",
  /** wire: `profile` — OIDC Core §5.4 */
  Profile: "profile",
} as const;

/**
 * Every scope value this vocabulary knows — the lindorm extensions plus the
 * RFC-standard set. Composed from the two above so no value is written twice.
 *
 * The type stays OPEN — RFC 6749 §3.3 lets any deployment define its own
 * scope values.
 */
export const Scope = {
  ...LindormScope,
  ...StandardScope,
} as const;

export type LindormScope = (typeof LindormScope)[keyof typeof LindormScope];

export type StandardScope = (typeof StandardScope)[keyof typeof StandardScope];

export type Scope = LindormScope | StandardScope | (string & {});
