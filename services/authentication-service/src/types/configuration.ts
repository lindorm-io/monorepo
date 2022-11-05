import { AuthenticationStrategy } from "../enum";
import { AuthenticationMethod } from "../common";

export type Hint = "email" | "phone" | "none";

export type InitialiseKey = "email" | "nin" | "nonce" | "phone_number" | "username" | "none";

export type InputKey =
  | "none"
  | "challenge_confirmation_token"
  | "code"
  | "otp"
  | "password"
  | "totp";

export type InputMode =
  | "none"
  | "decimal"
  | "email"
  | "numeric"
  | "search"
  | "tel"
  | "text"
  | "url";

export type ClientConfig = {
  hint: Hint;
  initialiseKey: InitialiseKey;
  method: AuthenticationMethod;
  rank: number;
  recommended: boolean;
  requested: boolean;
  strategies: Array<AuthenticationStrategy>;
};

export type DefaultStrategyConfig = {
  id: string;
  expiresIn: number;
  inputKey: InputKey;
  inputLength: number | null;
  inputMode: InputMode;
  pollingRequired: boolean;
  strategySessionToken: string | null;
};

export type StrategyInitialisation = {
  displayCode: string | null;
  qrCode: string | null;
};

export type StrategyConfig = DefaultStrategyConfig & StrategyInitialisation;
