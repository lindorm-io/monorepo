import { ReverseMap } from "../utility";

export const OauthDisplayModes = {
  PAGE: "page",
  POPUP: "popup",
  TOUCH: "touch",
  WAP: "wap",
} as const;

export type OauthDisplayMode = ReverseMap<typeof OauthDisplayModes>;
