import { Account, AuthenticationSession, StrategySession } from "../../../entity";
import { BROWSER_LINK_COOKIE_NAME } from "../../../constant";
import { ClientError } from "@lindorm-io/errors";
import { CryptoLayered } from "@lindorm-io/crypto";
import { ServerKoaContext } from "../../../types";
import { authenticateIdentifier } from "../../identity-service";
import { fetchAccountSalt } from "../../vault-service";

interface Options {
  password: string;
}

export const confirmPasswordBrowserLink = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
  strategySession: StrategySession,
  options: Options,
): Promise<Account> => {
  const {
    logger,
    repository: { accountRepository, browserLinkRepository },
  } = ctx;

  const { password } = options;

  logger.debug("Verifying Identity");

  const { identityId } = await authenticateIdentifier(ctx, authenticationSession, strategySession);

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
};
