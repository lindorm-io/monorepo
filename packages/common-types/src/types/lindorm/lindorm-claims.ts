import { LindormAddress } from "./lindorm-address";
import { OpenIdClaims } from "../open-id";

type CustomClaims = {
  // accessibility
  preferredAccessibility: Array<string>;

  // address
  address: LindormAddress;

  // connected_providers
  connectedProviders: Array<string>;

  // national_identity_number
  nationalIdentityNumber: string | null;
  nationalIdentityNumberVerified: boolean;

  // public
  active: boolean;
  displayName: string | null;
  gravatarUri: string | null;
  pronouns: string | null;

  // private
  username: string | null;

  // social_security_number
  socialSecurityNumber: string | null;
  socialSecurityNumberVerified: boolean;
};

export type LindormClaims = Omit<OpenIdClaims, "address"> & CustomClaims;
