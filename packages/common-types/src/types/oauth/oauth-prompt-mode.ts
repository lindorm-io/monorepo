import { ReverseMap } from "../utility";

export const OauthPromptModes = {
  CONSENT: "consent",
  LOGIN: "login",
  NONE: "none",
  SELECT_ACCOUNT: "select_account",
} as const;

export type OauthPromptMode = ReverseMap<typeof OauthPromptModes>;
