import { Account, AuthenticationSession, StrategySession } from "../entity";
import { AuthStrategyConfig } from "@lindorm-io/common-types";
import { AuthenticationStrategyConfig } from "./config";
import { ServerKoaContext } from "./context";

export type AcknowledgeStrategyOptions = {
  acknowledgeCode?: string;
  identityId: string;
};

export type AcknowledgeStrategyResult = {
  code: string;
  strategySessionToken: string;
};

export type ConfirmStrategyOptions = {
  challengeConfirmationToken?: string;
  code?: string;
  otp?: string;
  password?: string;
  token?: string;
  totp?: string;
};

export interface StrategyHandler {
  config: AuthenticationStrategyConfig;

  initialise(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
  ): Promise<AuthStrategyConfig>;

  acknowledge(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
    options: AcknowledgeStrategyOptions,
  ): Promise<AcknowledgeStrategyResult>;

  confirm(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
    options?: ConfirmStrategyOptions,
  ): Promise<Account>;
}
