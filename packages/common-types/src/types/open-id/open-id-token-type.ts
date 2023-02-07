import { ReverseMap } from "../utility";

export const OpenIdTokenTypes = {
  ACCESS: "access_token",
  ID: "id_token",
  LOGOUT: "logout_token",
  REFRESH: "refresh_token",
} as const;

export type OpenIdTokenType = ReverseMap<typeof OpenIdTokenTypes>;
