import { ReverseMap } from "../utility";

export const OauthResponseTypes = {
  CODE: "code",
  ID_TOKEN: "id_token",
  TOKEN: "token",
} as const;

export type OauthResponseType = ReverseMap<typeof OauthResponseTypes>;
