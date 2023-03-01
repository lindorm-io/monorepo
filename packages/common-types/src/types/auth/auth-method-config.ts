import { AuthenticationMethod, AuthenticationStrategy, IdentifierType } from "../../enums";

export type AuthMethodInitialiseHint = "email" | "phone" | "none";

export type AuthMethodConfig = {
  identifierHint: AuthMethodInitialiseHint;
  identifierType: IdentifierType | "none";
  method: AuthenticationMethod;
  rank: number;
  recommended: boolean;
  required: boolean;
  strategies: Array<AuthenticationStrategy>;
};
