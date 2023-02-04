import { ReverseMap } from "../utility";

export const OauthResponseModes = {
  FORM_POST: "form_post",
  FRAGMENT: "fragment",
  QUERY: "query",
} as const;

export type OauthResponseMode = ReverseMap<typeof OauthResponseModes>;
