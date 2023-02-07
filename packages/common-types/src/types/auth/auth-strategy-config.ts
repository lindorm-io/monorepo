export type AuthStrategyInputKey =
  | "none"
  | "challenge_confirmation_token"
  | "code"
  | "otp"
  | "password"
  | "totp";

export type AuthStrategyInputMode =
  | "none"
  | "decimal"
  | "email"
  | "numeric"
  | "search"
  | "tel"
  | "text"
  | "url";

export type AuthStrategyDefaultConfig = {
  id: string;
  expiresIn: number;
  inputKey: AuthStrategyInputKey;
  inputLength: number | null;
  inputMode: AuthStrategyInputMode;
  pollingRequired: boolean;
  strategySessionToken: string | null;
};

export type AuthStrategyInitialisation = {
  displayCode: string | null;
  qrCode: string | null;
};

export type AuthStrategyConfig = AuthStrategyDefaultConfig & AuthStrategyInitialisation;
