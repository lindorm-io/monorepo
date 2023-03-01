import { StandardRequestParamsWithId, StandardResponseWithSessionStatus } from "../../standard";
import { AuthenticationStrategy, SessionStatus } from "../../../../enums";

export type GetStrategyRequestParams = StandardRequestParamsWithId;

type ResponseWithData = {
  expires: Date | string;
  strategy: AuthenticationStrategy;
  status: SessionStatus;
};

export type GetStrategyResponse = ResponseWithData | StandardResponseWithSessionStatus;
