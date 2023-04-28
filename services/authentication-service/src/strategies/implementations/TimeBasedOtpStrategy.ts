import { Account, AuthenticationSession, StrategySession } from "../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { TOTPHandler } from "../../class";
import { configuration } from "../../server/configuration";
import { createStrategySessionToken, fetchAccountSalt } from "../../handler";
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
} from "@lindorm-io/common-types";

export class TimeBasedOtpStrategy implements StrategyHandler {
  public readonly config: AuthenticationStrategyConfig = {
    hintType: "none",
    identifierType: "none",
    loa: 2,
    loaMax: 3,
    method: AuthenticationMethod.TIME_BASED_OTP,
    mfaCookie: true,
    primary: false,
    requiresIdentity: true,
    secondary: true,
    strategy: AuthenticationStrategy.TIME_BASED_OTP,
    weight: 90,
  };

  public async initialise(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
  ): Promise<AuthStrategyConfig> {
    return {
      id: strategySession.id,
      acknowledgeCode: null,
      confirmKey: AuthenticationStrategyConfirmKey.TOTP,
      confirmLength: 6,
      confirmMode: AuthenticationStrategyConfirmMode.NUMERIC,
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
      logger,
      mongo: { accountRepository },
    } = ctx;

    const { totp } = options;

    if (!totp) {
      throw new ClientError("Invalid input", {
        data: { totp },
      });
    }

    logger.debug("Verifying Account");

    if (!authenticationSession.identityId) {
      throw new ServerError("Invalid authenticationSession", {
        debug: { identityId: authenticationSession.identityId },
      });
    }

    const account = await accountRepository.find({ id: authenticationSession.identityId });

    if (!account.totp) {
      throw new ClientError("Invalid Flow", {
        description: "Account does not have TOTP",
      });
    }

    logger.debug("Verifying TOTP");

    const salt = await fetchAccountSalt(ctx, account);
    const totpHandler = new TOTPHandler({
      aes: { secret: salt.aes },
      issuer: configuration.server.issuer,
    });

    await totpHandler.assert(totp, account.totp);

    return account;
  }
}
