import { AuthenticationStrategy, SessionStatus } from "../../../../enums";
import { StandardRequestParamsWithId, StandardResponseWithSessionStatus } from "../../standard";

export type GetStrategyRequestParams = StandardRequestParamsWithId;

type ResponseWithData = {
  expires: string;
  strategy: AuthenticationStrategy;
  status: SessionStatus;
};

export type GetStrategyResponse = ResponseWithData | StandardResponseWithSessionStatus;
