import { StandardRequestParamsWithId } from "../../standard";

export type ConfirmStrategyRequestParams = StandardRequestParamsWithId;

export type ConfirmStrategyRequestBody = {
  challengeConfirmationToken?: string;
  code?: string;
  otp?: string;
  password?: string;
  rdcSessionId?: never;
  rdcSessionStatus?: never;
  remember?: boolean;
  strategySessionToken: string;
  totp?: string;
};
