import { ReverseMap } from "../utility";

export const OauthGrantTypes = {
  AUTHORIZATION_CODE: "authorization_code",
  CLIENT_CREDENTIALS: "client_credentials",
  REFRESH_TOKEN: "refresh_token",
} as const;

export type OauthGrantType = ReverseMap<typeof OauthGrantTypes>;
