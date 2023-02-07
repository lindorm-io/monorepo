import { AuthenticationMethod } from "./authentication-method";
import { AuthenticationStrategy } from "./authentication-strategy";

export type AuthMethodInitialiseKey =
  | "email"
  | "nin"
  | "nonce"
  | "phone_number"
  | "username"
  | "none";

export type AuthMethodConfirmHint = "email" | "phone" | "none";

export type AuthMethodConfig = {
  hint: AuthMethodConfirmHint;
  initialiseKey: AuthMethodInitialiseKey;
  method: AuthenticationMethod;
  rank: number;
  recommended: boolean;
  requested: boolean;
  strategies: Array<AuthenticationStrategy>;
};
