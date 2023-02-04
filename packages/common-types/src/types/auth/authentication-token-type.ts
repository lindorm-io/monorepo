import { ReverseMap } from "../utility";

export const AuthenticationTokenTypeEnum = {
  AUTHENTICATION_CONFIRMATION_TOKEN: "authentication_confirmation_token",
  STRATEGY_SESSION_TOKEN: "strategy_session_token",
} as const;

export type AuthenticationTokenType = ReverseMap<typeof AuthenticationTokenTypeEnum>;
