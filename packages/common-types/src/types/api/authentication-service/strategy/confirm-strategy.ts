import { StandardRequestParamsWithId } from "../../standard";

export type ConfirmStrategyRequestParams = StandardRequestParamsWithId;

export type ConfirmStrategyRequestBody = {
  challengeConfirmationToken?: string;
  code?: string;
  otp?: string;
  password?: string;
  token?: string;
  totp?: string;

  strategySessionToken: string;

  remember?: boolean;
  sso?: boolean;
};
