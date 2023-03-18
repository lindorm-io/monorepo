import { StandardRequestParamsWithId } from "../../standard";

export type AcknowledgeStrategyRequestParams = StandardRequestParamsWithId;

export type AcknowledgeStrategyRequestBody = {
  displayCode?: string;
};

export type AcknowledgeStrategyResponse = {
  code: string;
  strategySessionToken: string;
};
