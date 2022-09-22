import { Account, AuthenticationSession } from "../../../entity";
import { ClientError } from "@lindorm-io/errors";
import { MFA_COOKIE_NAME } from "../../../constant";
import { ServerKoaContext } from "../../../types";

export const confirmMfaCookie = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
): Promise<Account> => {
  const {
    cache: { mfaCookieSessionCache },
    logger,
    repository: { accountRepository },
  } = ctx;

  logger.debug("Verifying Cookie");

  const cookieId = ctx.cookies.get(MFA_COOKIE_NAME, { signed: true });
  const mfaCookieSession = await mfaCookieSessionCache.find({ id: cookieId });

  if (authenticationSession.identityId !== mfaCookieSession.identityId) {
    throw new ClientError("Invalid Cookie", {
      description: "Invalid Identity ID",
    });
  }

  return await accountRepository.find({ id: authenticationSession.identityId });
};
