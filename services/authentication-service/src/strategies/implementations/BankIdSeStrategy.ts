import { Account, AuthenticationSession, StrategySession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import {
  AuthenticationStrategyConfig,
  ConfirmStrategyOptions,
  ServerKoaContext,
  StrategyHandler,
} from "../../types";
import {
  AuthenticationMethod,
  AuthenticationStrategy,
  AuthStrategyConfig,
} from "@lindorm-io/common-types";

export class BankIdSeStrategy implements StrategyHandler {
  public readonly config: AuthenticationStrategyConfig = {
    identifierHint: "none",
    identifierType: "none",
    loa: 2,
    loaMax: 3,
    method: AuthenticationMethod.MFA_COOKIE,
    methodsMax: 9,
    methodsMin: 1,
    mfaCookie: false,
    strategy: AuthenticationStrategy.MFA_COOKIE,
    weight: 999,
  };

  public async initialise(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
  ): Promise<AuthStrategyConfig> {
    throw new ServerError("Strategy not implemented");
  }

  public async confirm(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
    options: ConfirmStrategyOptions = {},
  ): Promise<Account> {
    throw new ServerError("Strategy not implemented");
  }
}
