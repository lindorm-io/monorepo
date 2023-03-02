import { Account, AuthenticationSession, StrategySession } from "../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { TOTPHandler } from "../../class";
import { configuration } from "../../server/configuration";
import { createStrategySessionToken, fetchAccountSalt } from "../../handler";
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

export class TimeBasedOtpStrategy implements StrategyHandler {
  public readonly config: AuthenticationStrategyConfig = {
    identifierHint: "none",
    identifierType: "none",
    loa: 2,
    loaMax: 3,
    method: AuthenticationMethod.TIME_BASED_OTP,
    methodsMax: 9,
    methodsMin: 1,
    mfaCookie: true,
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
      confirmKey: AuthenticationStrategyConfirmKey.TOTP,
      confirmLength: 6,
      confirmMode: AuthenticationStrategyConfirmMode.NUMERIC,
      displayCode: null,
      expires: strategySession.expires.toISOString(),
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
      logger,
      repository: { accountRepository },
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
