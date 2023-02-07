import { AuthenticationStrategy, AuthStrategyConfig } from "../../../auth";
import { StandardRequestParamsWithId } from "../../standard";

export type InitialiseStrategyRequestParams = StandardRequestParamsWithId;

export type InitialiseStrategyRequestBody = {
  email?: string;
  nin?: string;
  nonce?: string;
  phoneNumber?: string;
  strategy: AuthenticationStrategy;
  username?: string;
};

export type InitialiseStrategyResponse = AuthStrategyConfig;
