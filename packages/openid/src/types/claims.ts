// https://openid.net/specs/openid-connect-core-1_0.html#Claims

import type { NamingSystem } from "../enums/NamingSystem.js";
import type { Address } from "./address.js";
import type { GeoLocation } from "./geo-location.js";
import type { IdentityProvider } from "./identity-provider.js";
import type { InstantMessaging } from "./instant-messaging.js";
import type { SocialNetwork } from "./social-network.js";

/**
 * Claims lindorm ADDS — no OIDC counterpart exists. Grouped by the scope that
 * gates them.
 */
type NewLindormClaims = {
  // accessibility
  /**
   * wire: `preferred_accessibility` — deliberately an OPEN array of strings,
   * not a closed enum: these are hints a front end applies automatically
   * (contrast, motion, text size, …), so a deployment must be able to add its
   * own without a toolkit release.
   */
  preferredAccessibility: Array<string>;

  // auth
  /** wire: `permissions` */
  permissions: Array<string>;
  /** wire: `roles` */
  roles: Array<string>;

  // geo_location
  /** wire: `geo_location` */
  geoLocation: GeoLocation;

  // identity_providers
  /** wire: `identity_providers` */
  identityProviders: Array<IdentityProvider>;

  // instant_messaging
  /** wire: `instant_messaging` */
  instantMessaging: Array<InstantMessaging>;

  // legal
  /** wire: `legal_name` */
  legalName: string | null;
  /** wire: `legal_name_verified` */
  legalNameVerified: boolean;

  // national_identity_number
  /** wire: `national_identity_number` */
  nationalIdentityNumber: string | null;
  /** wire: `national_identity_number_verified` */
  nationalIdentityNumberVerified: boolean;

  // social_networks
  /** wire: `social_networks` */
  socialNetworks: Array<SocialNetwork>;

  // social_security_number
  /** wire: `social_security_number` */
  socialSecurityNumber: string | null;
  /** wire: `social_security_number_verified` */
  socialSecurityNumberVerified: boolean;

  // work_profile
  /** wire: `department` */
  department: string | null;
  /** wire: `job_title` */
  jobTitle: string | null;
  /** wire: `occupation` */
  occupation: string | null;
  /** wire: `organization` */
  organization: string | null;
};

/**
 * Claims lindorm EXTENDS the standard set with — they sit inside standard
 * scopes (`profile`, or always-present) but are not themselves OIDC claims.
 */
type ExtendingLindormClaims = {
  // always
  /** wire: `active` */
  active: boolean;
  /** wire: `avatar_uri` */
  avatarUri: string | null;
  /** wire: `display_name` */
  displayName: string | null;
  /** wire: `gravatar_uri` */
  gravatarUri: string | null;
  /** wire: `pronouns` */
  pronouns: string | null;

  // profile
  /** wire: `honorific` */
  honorific: string | null;
  /** wire: `language` */
  language: string | null;
  /** wire: `marital_status` */
  maritalStatus: string | null;
  /** wire: `naming_system` */
  namingSystem: NamingSystem | null;
  /** wire: `preferred_name` */
  preferredName: string | null;
  /** wire: `time_zone` */
  timeZone: string | null;
  /** wire: `username` */
  username: string | null;
};

/** The OIDC Core §5.1 standard claim set. */
type StandardClaims = {
  // always
  /** wire: `sub` — OIDC Core §5.1; REQUIRED */
  sub: string;
  /** wire: `updated_at` — OIDC Core §5.1 */
  updatedAt: number;

  // address
  /** wire: `address` — OIDC Core §5.1.1 */
  address: Address;

  // email
  /** wire: `email` — OIDC Core §5.1 */
  email: string | null;
  /** wire: `email_verified` — OIDC Core §5.1 */
  emailVerified: boolean;

  // phone
  /** wire: `phone_number` — OIDC Core §5.1 */
  phoneNumber: string | null;
  /** wire: `phone_number_verified` — OIDC Core §5.1 */
  phoneNumberVerified: boolean;

  // profile
  /** wire: `birthdate` — OIDC Core §5.1 */
  birthdate: string | null;
  /** wire: `family_name` — OIDC Core §5.1 */
  familyName: string | null;
  /** wire: `gender` — OIDC Core §5.1 */
  gender: string | null;
  /** wire: `given_name` — OIDC Core §5.1 */
  givenName: string | null;
  /** wire: `locale` — OIDC Core §5.1 */
  locale: string | null;
  /** wire: `middle_name` — OIDC Core §5.1 */
  middleName: string | null;
  /** wire: `name` — OIDC Core §5.1 */
  name: string | null;
  /** wire: `nickname` — OIDC Core §5.1 */
  nickname: string | null;
  /** wire: `picture` — OIDC Core §5.1 */
  picture: string | null;
  /** wire: `preferred_username` — OIDC Core §5.1 */
  preferredUsername: string | null;
  /** wire: `profile` — OIDC Core §5.1 */
  profile: string | null;
  /** wire: `website` — OIDC Core §5.1 */
  website: string | null;
  /** wire: `zoneinfo` — OIDC Core §5.1 */
  zoneinfo: string | null;
};

export type Claims = NewLindormClaims & ExtendingLindormClaims & StandardClaims;
