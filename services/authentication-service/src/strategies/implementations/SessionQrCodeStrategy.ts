import { Account, AuthenticationSession, StrategySession } from "../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { argon } from "../../instance";
import {
  AcknowledgeStrategyOptions,
  AcknowledgeStrategyResult,
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
  SessionStatus,
} from "@lindorm-io/common-types";
import { randomSecret, randomString } from "@lindorm-io/random";
import { createStrategySessionToken } from "../../handler";

export class SessionQrCodeStrategy implements StrategyHandler {
  public readonly config: AuthenticationStrategyConfig = {
    hintType: "none",
    identifierType: "none",
    loa: 2,
    loaMax: 3,
    method: AuthenticationMethod.SESSION_LINK,
    mfaCookie: true,
    primary: true,
    requiresIdentity: false,
    secondary: false,
    strategy: AuthenticationStrategy.SESSION_QR_CODE,
    weight: 80,
  };

  public async initialise(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
  ): Promise<AuthStrategyConfig> {
    const {
      redis: { strategySessionCache },
    } = ctx;

    const confirmLength = 16;
    const acknowledgeCode = randomString(confirmLength).toUpperCase();

    strategySession.secret = await argon.encrypt(acknowledgeCode);

    await strategySessionCache.update(strategySession);

    return {
      id: strategySession.id,
      acknowledgeCode,
      confirmKey: AuthenticationStrategyConfirmKey.CODE,
      confirmLength,
      confirmMode: AuthenticationStrategyConfirmMode.NONE,
      expires: strategySession.expires.toISOString(),
      pollingRequired: true,
      qrCode: "QR_CODE",
      strategySessionToken: null,
      visualHint: null,
    };
  }

  public async acknowledge(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
    options: AcknowledgeStrategyOptions,
  ): Promise<AcknowledgeStrategyResult> {
    const {
      redis: { strategySessionCache },
      logger,
    } = ctx;

    const { acknowledgeCode, identityId } = options;

    if (!acknowledgeCode) {
      throw new ClientError("Invalid request", {
        data: { acknowledgeCode },
      });
    }

    logger.debug("Verifying Code");

    if (!strategySession.secret) {
      throw new ServerError("Invalid strategySession", {
        debug: { code: strategySession.secret },
      });
    }

    await argon.assert(acknowledgeCode, strategySession.secret);

    logger.debug("Generating new code");

    const code = randomSecret(32);

    strategySession.secret = await argon.encrypt(code);
    strategySession.identityId = identityId;
    strategySession.status = SessionStatus.ACKNOWLEDGED;

    strategySession = await strategySessionCache.update(strategySession);

    const strategySessionToken = createStrategySessionToken(ctx, strategySession);

    return { code, strategySessionToken };
  }

  public async confirm(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
    options: ConfirmStrategyOptions = {},
  ): Promise<Account> {
    const {
      logger,
      mongo: { accountRepository },
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
