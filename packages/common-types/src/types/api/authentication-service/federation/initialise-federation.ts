import { StandardRequestParamsWithId } from "../../standard";

export type InitialiseAuthFederationRequestParams = StandardRequestParamsWithId;

export type InitialiseAuthFederationRequestQuery = {
  provider: string;
  remember?: boolean;
};
