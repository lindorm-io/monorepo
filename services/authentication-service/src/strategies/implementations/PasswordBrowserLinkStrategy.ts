import { Account, AuthenticationSession, StrategySession } from "../../entity";
import { BROWSER_LINK_COOKIE_NAME } from "../../constant";
import { ClientError } from "@lindorm-io/errors";
import { ConfirmStrategyOptions, StrategyBase } from "../../class";
import { CryptoLayered } from "@lindorm-io/crypto";
import { AuthenticationStrategyConfig, ServerKoaContext } from "../../types";
import { authenticateIdentifier, fetchAccountSalt, resolveIdentity } from "../../handler";
import {
  AuthenticationMethod,
  AuthenticationStrategy,
  AuthenticationStrategyConfirmKey,
  AuthenticationStrategyConfirmMode,
  AuthStrategyConfig,
  IdentifierType,
} from "@lindorm-io/common-types";

export class PasswordBrowserLinkStrategy extends StrategyBase {
  public config(): AuthenticationStrategyConfig {
    return {
      identifierHint: "none",
      identifierType: IdentifierType.USERNAME,
      loa: 3,
      loaMax: 3,
      method: AuthenticationMethod.PASSWORD,
      methodsMax: 0,
      methodsMin: 0,
      mfaCookie: false,
      strategy: AuthenticationStrategy.PASSWORD_BROWSER_LINK,
      weight: 20,
    };
  }

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
      expiresIn: this.expiresIn(strategySession),
      pollingRequired: false,
      qrCode: null,
      strategySessionToken: this.sessionToken(ctx, strategySession),
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
      repository: { accountRepository, browserLinkRepository },
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
