import {
  AuthStrategyConfig,
  AuthenticationMethod,
  AuthenticationStrategy,
  AuthenticationStrategyConfirmKey,
  AuthenticationStrategyConfirmMode,
  IdentifierType,
} from "@lindorm-io/common-types";
import { CryptoLayered } from "@lindorm-io/crypto";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { BROWSER_LINK_COOKIE_NAME } from "../../constant";
import { Account, AuthenticationSession, StrategySession } from "../../entity";
import {
  authenticateIdentifier,
  createStrategySessionToken,
  fetchAccountSalt,
  resolveIdentity,
} from "../../handler";
import {
  AcknowledgeStrategyOptions,
  AcknowledgeStrategyResult,
  AuthenticationStrategyConfig,
  ConfirmStrategyOptions,
  ServerKoaContext,
  StrategyHandler,
} from "../../types";

export class PasswordBrowserLinkStrategy implements StrategyHandler {
  public readonly config: AuthenticationStrategyConfig = {
    hintType: "none",
    identifierType: IdentifierType.USERNAME,
    loa: 3,
    loaMax: 3,
    method: AuthenticationMethod.PASSWORD,
    mfaCookie: false,
    primary: true,
    requiresIdentity: false,
    secondary: false,
    strategy: AuthenticationStrategy.PASSWORD_BROWSER_LINK,
    weight: 20,
  };

  public async initialise(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
  ): Promise<AuthStrategyConfig> {
    return {
      id: strategySession.id,
      acknowledgeCode: null,
      confirmKey: AuthenticationStrategyConfirmKey.PASSWORD,
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
      mongo: { accountRepository, browserLinkRepository },
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

    logger.debug("Verifying Cookie");

    const cookieId = ctx.cookies.get(BROWSER_LINK_COOKIE_NAME, { signed: true });
    const browserLink = await browserLinkRepository.find({ id: cookieId });

    if (identityId !== browserLink.accountId) {
      throw new ClientError("Invalid Cookie", {
        description: "Invalid Browser Link",
      });
    }

    return account;
  }
}
