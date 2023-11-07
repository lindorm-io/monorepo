import {
  AuthStrategyConfig,
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  AuthenticationStrategyConfirmKey,
  AuthenticationStrategyConfirmMode,
} from "@lindorm-io/common-types";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { MFA_COOKIE_NAME } from "../../constant";
import { Account, AuthenticationSession, StrategySession } from "../../entity";
import { createStrategySessionToken } from "../../handler";
import {
  AcknowledgeStrategyOptions,
  AcknowledgeStrategyResult,
  AuthenticationStrategyConfig,
  ConfirmStrategyOptions,
  ServerKoaContext,
  StrategyHandler,
} from "../../types";

export class MfaCookieStrategy implements StrategyHandler {
  public readonly config: AuthenticationStrategyConfig = {
    factor: AuthenticationFactor.ONE_FACTOR,
    hintType: "none",
    identifierType: "none",
    loa: 2,
    loaMax: 3,
    method: AuthenticationMethod.MFA_COOKIE,
    mfaCookie: false,
    primary: false,
    requiresIdentity: true,
    secondary: true,
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
      acknowledgeCode: null,
      confirmKey: AuthenticationStrategyConfirmKey.NONE,
      confirmLength: null,
      confirmMode: AuthenticationStrategyConfirmMode.NONE,
      expires: strategySession.expires.toISOString(),
      pollingRequired: false,
      qrCode: null,
      strategySessionToken: createStrategySessionToken(ctx, strategySession),
      visualHint: null,
    };
  }

  public async acknowledge(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
    options: AcknowledgeStrategyOptions,
  ): Promise<AcknowledgeStrategyResult> {
    throw new ServerError("Strategy does not support this method");
  }

  public async confirm(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
    options: ConfirmStrategyOptions = {},
  ): Promise<Account> {
    const {
      redis: { mfaCookieSessionCache },
      logger,
      mongo: { accountRepository },
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
