import { ReverseMap } from "../utility";

export const OpenIdTokenTypeEnum = {
  ACCESS_TOKEN: "access_token",
  ID_TOKEN: "id_token",
  LOGOUT_TOKEN: "logout_token",
  REFRESH_TOKEN: "refresh_token",
} as const;

export type OpenIdTokenType = ReverseMap<typeof OpenIdTokenTypeEnum>;
