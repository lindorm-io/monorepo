import { OpenIDAddress, OpenIDClaims } from "./openid";

export interface IdentityServiceAddress extends OpenIDAddress {
  careOf: string | null;
}

export interface IdentityServiceClaims extends OpenIDClaims {
  // address
  address: IdentityServiceAddress;

  // profile
  displayName: string | null;
  gravatarUri: string | null;
  pronouns: string | null;

  // private
  connectedProviders: Array<string>;
  nationalIdentityNumber: string | null;
  nationalIdentityNumberVerified: boolean;
  preferredAccessibility: Array<string>;
  socialSecurityNumber: string | null;
  socialSecurityNumberVerified: boolean;
  username: string | null;
}
