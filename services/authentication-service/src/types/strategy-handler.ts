import { Account, AuthenticationSession, StrategySession } from "../entity";
import { AuthStrategyConfig } from "@lindorm-io/common-types";
import { AuthenticationStrategyConfig } from "./config";
import { ServerKoaContext } from "./context";

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
  confirm(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
    options?: ConfirmStrategyOptions,
  ): Promise<Account>;
}
