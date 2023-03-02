import { Account, AuthenticationSession, StrategySession } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { CryptoLayered } from "@lindorm-io/crypto";
import {
  AuthenticationStrategyConfig,
  ConfirmStrategyOptions,
  ServerKoaContext,
  StrategyHandler,
} from "../../types";
import {
  authenticateIdentifier,
  createStrategySessionToken,
  fetchAccountSalt,
  resolveIdentity,
} from "../../handler";
import {
  AuthenticationMethod,
  AuthenticationStrategy,
  AuthenticationStrategyConfirmKey,
  AuthenticationStrategyConfirmMode,
  AuthStrategyConfig,
  IdentifierType,
} from "@lindorm-io/common-types";

export class PasswordStrategy implements StrategyHandler {
  public readonly config: AuthenticationStrategyConfig = {
    identifierHint: "email",
    identifierType: IdentifierType.USERNAME,
    loa: 2,
    loaMax: 3,
    method: AuthenticationMethod.PASSWORD,
    methodsMax: 0,
    methodsMin: 0,
    mfaCookie: false,
    strategy: AuthenticationStrategy.PASSWORD,
    weight: 10,
  };

  public async initialise(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
  ): Promise<AuthStrategyConfig> {
    return {
      id: strategySession.id,
      confirmKey: AuthenticationStrategyConfirmKey.PASSWORD,
      confirmLength: null,
      confirmMode: AuthenticationStrategyConfirmMode.TEXT,
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

    const { password } = options;

    if (!password) {
      throw new ClientError("Invalid input", {
        data: { password },
      });
    }

    logger.debug("Verifying Identity");

    authenticationSession = await resolveIdentity(ctx, authenticationSession, strategySession);
    const { identityId } = await authenticateIdentifier(
      ctx,
      authenticationSession,
      strategySession,
    );

    logger.debug("Verifying Account");

    const account = await accountRepository.find({ id: identityId });

    if (!account.password) {
      throw new ClientError("Invalid Flow", {
        description: "Account does not have a Password",
      });
    }

    logger.debug("Verifying Password");

    const salt = await fetchAccountSalt(ctx, account);
    const crypto = new CryptoLayered({
      aes: { secret: salt.aes },
      sha: { secret: salt.sha },
    });

    await crypto.assert(password, account.password);

    return account;
  }
}
