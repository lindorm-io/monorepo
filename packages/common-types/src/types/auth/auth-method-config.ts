import {
  AuthenticationMethod,
  AuthenticationStrategy,
  IdentifierType,
} from "@lindorm-io/common-enums";

export type AuthMethodInitialiseHint = "email" | "phone" | "none";

export type ConfigStrategy = {
  strategy: AuthenticationStrategy;
  weight: number;
};

export type AuthMethodConfig = {
  hint: string | null;
  hintType: AuthMethodInitialiseHint;
  identifierType: IdentifierType | "none";
  method: AuthenticationMethod;
  rank: number;
  recommended: boolean;
  required: boolean;
  strategies: Array<ConfigStrategy>;
  weight: number;
};
