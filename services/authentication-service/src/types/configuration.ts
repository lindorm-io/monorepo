import { AuthenticationStrategy } from "../enum";
import { AuthenticationMethod } from "../common";

export type Hint = "email" | "phone" | "none";

export type InitialiseKey = "email" | "nin" | "nonce" | "phone_number" | "username" | "none";

export type ConfirmKey =
  | "challenge_confirmation_token"
  | "code"
  | "otp"
  | "password"
  | "totp"
  | "none";

export type ClientConfig = {
  hint: Hint;
  initialiseKey: InitialiseKey;
  method: AuthenticationMethod;
  rank: number;
  strategies: Array<AuthenticationStrategy>;
};
