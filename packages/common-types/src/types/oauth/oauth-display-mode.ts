import { ReverseMap } from "../utility";

export const OauthDisplayModeEnum = {
  PAGE: "page",
  POPUP: "popup",
  TOUCH: "touch",
  WAP: "wap",
} as const;

export type OauthDisplayMode = ReverseMap<typeof OauthDisplayModeEnum>;
