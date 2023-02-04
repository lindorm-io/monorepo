import { ReverseMap } from "../utility";

export const OauthGrantTypeEnum = {
  AUTHORIZATION_CODE: "authorization_code",
  CLIENT_CREDENTIALS: "client_credentials",
  REFRESH_TOKEN: "refresh_token",
} as const;

export type OauthGrantType = ReverseMap<typeof OauthGrantTypeEnum>;
