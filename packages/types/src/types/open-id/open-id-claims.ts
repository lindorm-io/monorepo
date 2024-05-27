import { OpenIdAddress } from "./open-id-address";
import { OpenIdGeoLocation } from "./open-id-geo-location";
import { OpenIdIdentityProvider } from "./open-id-identity-provider";
import { OpenIdInstantMessaging } from "./open-id-instant-messaging";
import { OpenIdNamingSystem } from "./open-id-naming-system";
import { OpenIdSocialNetwork } from "./open-id-social-network";

type NewLindormClaims = {
  // accessibility
  preferredAccessibility: Array<string>;

  // auth
  permissions: Array<string>;
  roles: Array<string>;

  // geo_location
  geoLocation: OpenIdGeoLocation;

  // identity_providers
  identityProviders: Array<OpenIdIdentityProvider>;

  // instant_messaging
  instantMessaging: Array<OpenIdInstantMessaging>;

  // legal
  legalName: string | null;
  legalNameVerified: boolean;

  // national_identity_number
  nationalIdentityNumber: string | null;
  nationalIdentityNumberVerified: boolean;

  // social_networks
  socialNetworks: Array<OpenIdSocialNetwork>;

  // social_security_number
  socialSecurityNumber: string | null;
  socialSecurityNumberVerified: boolean;

  // work_profile
  department: string | null;
  jobTitle: string | null;
  occupation: string | null;
  organization: string | null;
};

type ExtendingLindormClaims = {
  // always
  active: boolean;
  avatarUri: string | null;
  displayName: string | null;
  gravatarUri: string | null;
  pronouns: string | null;

  // profile
  language: string | null;
  maritalStatus: string | null;
  namingSystem: OpenIdNamingSystem | null;
  preferredName: string | null;
  timeZone: string | null;
  username: string | null;
};

type StandardClaims = {
  // always
  sub: string;
  updatedAt: number;

  // address
  address: OpenIdAddress;

  // email
  email: string | null;
  emailVerified: boolean;

  // phone
  phoneNumber: string | null;
  phoneNumberVerified: boolean;

  // profile
  birthDate: string | null;
  familyName: string | null;
  gender: string | null;
  givenName: string | null;
  locale: string | null;
  middleName: string | null;
  name: string | null;
  nickname: string | null;
  picture: string | null;
  preferredUsername: string | null;
  profile: string | null;
  website: string | null;
  zoneinfo: string | null;
};

export type OpenIdClaims = NewLindormClaims & ExtendingLindormClaims & StandardClaims;
