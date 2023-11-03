import { AuthenticationStrategy, IdentifierType } from "../../../../enums";
import { AuthStrategyConfig } from "../../../auth";
import { StandardRequestParamsWithId } from "../../standard";

export type InitialiseStrategyRequestParams = StandardRequestParamsWithId;

export type InitialiseStrategyRequestBody = {
  identifier: string;
  identifierType: IdentifierType;
  nonce?: string;
  strategy: AuthenticationStrategy;
};

export type InitialiseStrategyResponse = AuthStrategyConfig;
