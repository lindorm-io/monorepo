import {
  AuthenticationMethod,
  AuthenticationStrategy,
  AuthMethodInitialiseHint,
  IdentifierType,
  LevelOfAssurance,
} from "@lindorm-io/common-types";

export type AuthenticationStrategyConfig = {
  hintType: AuthMethodInitialiseHint;
  identifierType: IdentifierType | "none";
  loa: LevelOfAssurance;
  loaMax: LevelOfAssurance;
  method: AuthenticationMethod;
  mfaCookie: boolean;
  primary: boolean;
  requiresIdentity: boolean;
  secondary: boolean;
  strategy: AuthenticationStrategy;
  weight: number;
};
