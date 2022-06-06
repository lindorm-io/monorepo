export interface OpenIDAddress {
  formatted: string | null;
  country: string | null;
  locality: string | null;
  postalCode: string | null;
  region: string | null;
  streetAddress: string | null;
}

export interface OpenIDClaims {
  // always
  sub: string;
  updatedAt: number;

  // address
  address: OpenIDAddress;

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
  zoneInfo: string | null;
}
