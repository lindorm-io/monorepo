import { Account, LoginSession, FlowSession } from "../../../entity";
import { BROWSER_LINK_COOKIE_NAME } from "../../../constant";
import { ClientError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../../types";
import { CryptoLayered } from "@lindorm-io/crypto";
import { identityAuthenticateIdentifier, vaultGetSalt } from "../../axios";

interface Options {
  password: string;
}

export const confirmPasswordBrowserLinkFlow = async (
  ctx: ServerKoaContext,
  loginSession: LoginSession,
  flowSession: FlowSession,
  options: Options,
): Promise<Account> => {
  const {
    logger,
    repository: { accountRepository, browserLinkRepository },
  } = ctx;

  const { password } = options;

  logger.info("Confirming Flow", {
    loginSessionId: loginSession.id,
    flowSessionId: flowSession.id,
    type: flowSession.type,
  });

  logger.debug("Verifying Identity");

  const { identityId } = await identityAuthenticateIdentifier(ctx, loginSession, flowSession);

  logger.debug("Verifying Account");

  const account = await accountRepository.find({ id: identityId });

  if (!account.password) {
    throw new ClientError("Invalid Flow", {
      description: "Account does not have a Recovery Code",
    });
  }

  logger.debug("Verifying Password");

  const salt = await vaultGetSalt(ctx, account);
  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    sha: { secret: salt.sha },
  });

  await crypto.assert(password, account.password);

  logger.debug("Verifying Cookie");

  const cookieId = ctx.getCookie(BROWSER_LINK_COOKIE_NAME);
  const browserLink = await browserLinkRepository.find({ id: cookieId });

  if (identityId !== browserLink.identityId) {
    throw new ClientError("Invalid Cookie", {
      description: "Invalid Browser Link",
    });
  }

  return account;
};
