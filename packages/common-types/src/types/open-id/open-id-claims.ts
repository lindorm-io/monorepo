import { OpenIdAddress } from "./open-id-address";

export type OpenIdClaims = {
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
  zoneInfo: string | null;
};
