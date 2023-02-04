import { ReverseMap } from "../utility";

export const OauthResponseModeEnum = {
  FORM_POST: "form_post",
  FRAGMENT: "fragment",
  QUERY: "query",
} as const;

export type OauthResponseMode = ReverseMap<typeof OauthResponseModeEnum>;
