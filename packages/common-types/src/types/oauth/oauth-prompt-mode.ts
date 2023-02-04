import { ReverseMap } from "../utility";

export const OauthPromptModeEnum = {
  CONSENT: "consent",
  LOGIN: "login",
  NONE: "none",
  SELECT_ACCOUNT: "select_account",
} as const;

export type OauthPromptMode = ReverseMap<typeof OauthPromptModeEnum>;
