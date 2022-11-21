import { AuthenticationMethod, AuthenticationStrategy } from "../enum";

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
  expires_in: number;
  input_key: InputKey;
  input_length: number | null;
  input_mode: InputMode;
  polling_required: boolean;
  strategy_session_token: string | null;
};

export type StrategyInitialisation = {
  display_code: string | null;
  qr_code: string | null;
};

export type StrategyConfig = DefaultStrategyConfig & StrategyInitialisation;
