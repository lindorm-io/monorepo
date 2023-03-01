import { StandardRequestParamsWithId } from "../../standard";

export type AcknowledgeStrategyRequestParams = StandardRequestParamsWithId;

export type AcknowledgeStrategyResponse = {
  code: string;
  strategySessionToken: string;
};
