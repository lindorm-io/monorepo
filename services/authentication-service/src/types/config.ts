import {
  AuthenticationMethod,
  AuthenticationStrategy,
  AuthMethodInitialiseHint,
  IdentifierType,
  LevelOfAssurance,
} from "@lindorm-io/common-types";

export type AuthenticationStrategyConfig = {
  identifierHint: AuthMethodInitialiseHint;
  identifierType: IdentifierType | "none";
  loa: LevelOfAssurance;
  loaMax: LevelOfAssurance;
  method: AuthenticationMethod;
  methodsMax: number;
  methodsMin: number;
  mfaCookie: boolean;
  strategy: AuthenticationStrategy;
  weight: number;
};
