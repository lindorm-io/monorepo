import { MFA_COOKIE_NAME } from "../../constant";
import {
  AuthenticationStrategyConfig,
  ConfirmStrategyOptions,
  ServerKoaContext,
  StrategyHandler,
} from "../../types";
import { Account, AuthenticationSession, StrategySession } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import {
  AuthenticationMethod,
  AuthenticationStrategy,
  AuthenticationStrategyConfirmKey,
  AuthenticationStrategyConfirmMode,
  AuthStrategyConfig,
} from "@lindorm-io/common-types";
import { expiresIn } from "@lindorm-io/expiry";
import { createStrategySessionToken } from "../../handler";

export class MfaCookieStrategy implements StrategyHandler {
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
    return {
      id: strategySession.id,
      confirmKey: AuthenticationStrategyConfirmKey.NONE,
      confirmLength: null,
      confirmMode: AuthenticationStrategyConfirmMode.NONE,
      displayCode: null,
      expiresIn: expiresIn(strategySession.expires),
      pollingRequired: false,
      qrCode: null,
      strategySessionToken: createStrategySessionToken(ctx, strategySession),
      visualHint: null,
    };
  }

  public async confirm(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
    options: ConfirmStrategyOptions = {},
  ): Promise<Account> {
    const {
      cache: { mfaCookieSessionCache },
      logger,
      repository: { accountRepository },
    } = ctx;

    logger.debug("Verifying Cookie");

    const cookieId = ctx.cookies.get(MFA_COOKIE_NAME, { signed: true });
    const mfaCookieSession = await mfaCookieSessionCache.find({ id: cookieId });

    if (authenticationSession.identityId !== mfaCookieSession.identityId) {
      throw new ClientError("Invalid Cookie", {
        description: "Invalid Identity ID",
      });
    }

    return await accountRepository.find({ id: authenticationSession.identityId });
  }
}
