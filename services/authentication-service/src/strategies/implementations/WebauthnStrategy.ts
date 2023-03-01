import { ConfirmStrategyOptions, StrategyBase } from "../../class";
import { AuthenticationStrategyConfig, ServerKoaContext } from "../../types";
import { Account, AuthenticationSession, StrategySession } from "../../entity";
import {
  AuthenticationMethod,
  AuthenticationStrategy,
  AuthStrategyConfig,
} from "@lindorm-io/common-types";
import { ServerError } from "@lindorm-io/errors";

export class WebauthnStrategy extends StrategyBase {
  public config(): AuthenticationStrategyConfig {
    return {
      identifierHint: "none",
      identifierType: "none",
      loa: 2,
      loaMax: 3,
      method: AuthenticationMethod.WEBAUTHN,
      methodsMax: 9,
      methodsMin: 0,
      mfaCookie: true,
      strategy: AuthenticationStrategy.WEBAUTHN,
      weight: 90,
    };
  }

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
