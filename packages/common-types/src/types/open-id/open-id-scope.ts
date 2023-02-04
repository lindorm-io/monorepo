import { ReverseMap } from "../utility";

export const OpenIdScopes = {
  ADDRESS: "address",
  EMAIL: "email",
  OFFLINE_ACCESS: "offline_access",
  OPENID: "openid",
  PHONE: "phone",
  PROFILE: "profile",
} as const;

export type OpenIdScope = ReverseMap<typeof OpenIdScopes>;
