import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  IdentifierType,
} from "@lindorm-io/common-enums";
import { AuthMethodInitialiseHint, LevelOfAssurance } from "@lindorm-io/common-types";

export type AuthenticationStrategyConfig = {
  factor: AuthenticationFactor;
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
