import { Account, AuthenticationSession, StrategySession } from "../entity";
import { AuthStrategyConfig } from "@lindorm-io/common-types";
import { AuthenticationStrategyConfig } from "./config";
import { ConfirmStrategyOptions } from "../class";
import { ServerKoaContext } from "./context";

export interface StrategyHandler {
  config(): AuthenticationStrategyConfig;
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
