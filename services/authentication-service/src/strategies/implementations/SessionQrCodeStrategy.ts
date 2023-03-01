import { ConfirmStrategyOptions, StrategyBase } from "../../class";
import { AuthenticationStrategyConfig, ServerKoaContext } from "../../types";
import { Account, AuthenticationSession, StrategySession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import {
  AuthenticationMethod,
  AuthenticationStrategy,
  AuthenticationStrategyConfirmKey,
  AuthenticationStrategyConfirmMode,
  AuthStrategyConfig,
} from "@lindorm-io/common-types";

export class SessionQrCodeStrategy extends StrategyBase {
  public config(): AuthenticationStrategyConfig {
    return {
      identifierHint: "none",
      identifierType: "none",
      loa: 2,
      loaMax: 3,
      method: AuthenticationMethod.SESSION_LINK,
      methodsMax: 9,
      methodsMin: 0,
      mfaCookie: true,
      strategy: AuthenticationStrategy.SESSION_QR_CODE,
      weight: 80,
    };
  }

  public async initialise(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
  ): Promise<AuthStrategyConfig> {
    return {
      id: strategySession.id,
      confirmKey: AuthenticationStrategyConfirmKey.CODE,
      confirmLength: null,
      confirmMode: AuthenticationStrategyConfirmMode.NONE,
      displayCode: null,
      expiresIn: this.expiresIn(strategySession),
      pollingRequired: true,
      qrCode: "QR_CODE",
      strategySessionToken: null,
      visualHint: null,
    };
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
