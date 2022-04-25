export interface OpenIDAddress {
  formatted: string;
  country: string;
  locality: string;
  postalCode: string;
  region: string;
  streetAddress: string;
}

export interface OpenIDClaims {
  // always
  sub: string;
  updatedAt: number;

  // address
  address: OpenIDAddress;

  // email
  email: string;
  emailVerified: boolean;

  // phone
  phoneNumber: string;
  phoneNumberVerified: boolean;

  // profile
  birthDate: string;
  familyName: string;
  gender: string;
  givenName: string;
  locale: string;
  middleName: string;
  name: string;
  nickname: string;
  picture: string;
  preferredUsername: string;
  profile: string;
  website: string;
  zoneInfo: string;
}
