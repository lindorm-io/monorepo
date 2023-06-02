import { OpenIdClaims } from "../open-id";
import { LindormAddress } from "./lindorm-address";

type CustomClaims = {
  // accessibility
  preferredAccessibility: Array<string>;

  // address
  address: LindormAddress;

  // national_identity_number
  nationalIdentityNumber: string | null;
  nationalIdentityNumberVerified: boolean;

  // public
  active: boolean;
  displayName: string | null;
  avatarUri: string | null;
  pronouns: string | null;

  // private
  username: string | null;

  // profile
  maritalStatus: string | null;
  preferredName: string | null;

  // social_security_number
  socialSecurityNumber: string | null;
  socialSecurityNumberVerified: boolean;
};

export type LindormIdentityClaims = Omit<OpenIdClaims, "address"> & CustomClaims;
