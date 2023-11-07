import {
  AuthStrategyConfig,
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  AuthenticationStrategyConfirmKey,
  AuthenticationStrategyConfirmMode,
} from "@lindorm-io/common-types";
import { CryptoLayered } from "@lindorm-io/crypto";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { Account, AuthenticationSession, StrategySession } from "../../entity";
import { createStrategySessionToken, fetchAccountSalt } from "../../handler";
import {
  AcknowledgeStrategyOptions,
  AcknowledgeStrategyResult,
  AuthenticationStrategyConfig,
  ConfirmStrategyOptions,
  ServerKoaContext,
  StrategyHandler,
} from "../../types";

export class RecoveryCodeStrategy implements StrategyHandler {
  public readonly config: AuthenticationStrategyConfig = {
    factor: AuthenticationFactor.ONE_FACTOR,
    hintType: "none",
    identifierType: "none",
    loa: 1,
    loaMax: 3,
    method: AuthenticationMethod.RECOVERY,
    mfaCookie: false,
    primary: false,
    requiresIdentity: false,
    secondary: true,
    strategy: AuthenticationStrategy.RECOVERY_CODE,
    weight: 0,
  };

  public async initialise(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
  ): Promise<AuthStrategyConfig> {
    return {
      id: strategySession.id,
      acknowledgeCode: null,
      confirmKey: AuthenticationStrategyConfirmKey.CODE,
      confirmLength: null,
      confirmMode: AuthenticationStrategyConfirmMode.TEXT,
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

    const { code } = options;

    if (!code) {
      throw new ClientError("Invalid input", {
        data: { code },
      });
    }

    logger.debug("Verifying Account");

    if (!authenticationSession.identityId) {
      throw new ServerError("Invalid authenticationSession", {
        debug: { identityId: authenticationSession.identityId },
      });
    }

    const account = await accountRepository.find({ id: authenticationSession.identityId });

    if (!account.recoveryCode) {
      throw new ClientError("Invalid Strategy", {
        description: "Account does not have a Recovery Code",
      });
    }

    logger.debug("Verifying Recovery Code");

    const salt = await fetchAccountSalt(ctx, account);
    const crypto = new CryptoLayered({
      aes: { secret: salt.aes },
      sha: { secret: salt.sha },
    });

    await crypto.assert(code, account.recoveryCode);

    account.recoveryCode = null;

    return accountRepository.update(account);
  }
}
