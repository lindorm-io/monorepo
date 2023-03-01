import { Account, AuthenticationSession, StrategySession } from "../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { argon } from "../../instance";
import { expiresIn } from "@lindorm-io/expiry";
import {
  AuthenticationStrategyConfig,
  ConfirmStrategyOptions,
  ServerKoaContext,
  StrategyHandler,
} from "../../types";
import {
  AuthenticationMethod,
  AuthenticationStrategy,
  AuthenticationStrategyConfirmKey,
  AuthenticationStrategyConfirmMode,
  AuthStrategyConfig,
} from "@lindorm-io/common-types";

export class SessionQrCodeStrategy implements StrategyHandler {
  public readonly config: AuthenticationStrategyConfig = {
    identifierHint: "none",
    identifierType: "none",
    loa: 2,
    loaMax: 3,
    method: AuthenticationMethod.SESSION_LINK,
    methodsMax: 0,
    methodsMin: 0,
    mfaCookie: true,
    strategy: AuthenticationStrategy.SESSION_QR_CODE,
    weight: 80,
  };

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
      expiresIn: expiresIn(strategySession.expires),
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
    const {
      logger,
      repository: { accountRepository },
    } = ctx;

    const { code } = options;

    if (!code) {
      throw new ClientError("Invalid input", {
        data: { code },
      });
    }

    logger.debug("Verifying code");

    if (!strategySession.secret) {
      throw new ServerError("Invalid strategy session", {
        debug: { otp: strategySession.secret },
      });
    }

    await argon.assert(code, strategySession.secret);

    logger.debug("Resolving Account");

    if (!strategySession.identityId) {
      throw new ServerError("Invalid strategy session", {
        debug: { identityId: strategySession.identityId },
      });
    }

    return await accountRepository.find({ id: strategySession.identityId });
  }
}
