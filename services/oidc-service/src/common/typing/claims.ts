import { OpenIDAddress, OpenIDClaims } from "./openid";

export interface IdentityServiceAddress extends OpenIDAddress {
  careOf: string;
}

export interface IdentityServiceClaims extends OpenIDClaims {
  // address
  address: IdentityServiceAddress;

  // profile
  displayName: string;
  gravatarUri: string;
  pronouns: string;

  // private
  connectedProviders: Array<string>;
  nationalIdentityNumber: string;
  preferredAccessibility: Array<string>;
  socialSecurityNumber: string;
  username: string;
}
