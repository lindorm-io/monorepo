import { StandardRequestParamsWithId, StandardResponseWithStatus } from "../../standard";
import { AuthenticationStrategy } from "../../../auth";
import { SessionStatus } from "../../../global";

export type GetStrategyRequestParams = StandardRequestParamsWithId;

type ResponseWithData = {
  expires: Date | string;
  strategy: AuthenticationStrategy;
  status: SessionStatus;
};

export type GetStrategyResponse = ResponseWithData | StandardResponseWithStatus;
