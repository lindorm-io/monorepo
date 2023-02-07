import { ReverseMap } from "../utility";

export const AuthenticationTokenTypes = {
  AUTHENTICATION_CONFIRMATION: "authentication_confirmation_token",
  STRATEGY_SESSION: "strategy_session_token",
} as const;

export type AuthenticationTokenType = ReverseMap<typeof AuthenticationTokenTypes>;
