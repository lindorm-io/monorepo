import { Account, LoginSession, FlowSession } from "../../../entity";
import { ClientError } from "@lindorm-io/errors";
import { Context } from "../../../types";
import { MFA_COOKIE_NAME } from "../../../constant";

export const confirmMfaCookieFlow = async (
  ctx: Context,
  loginSession: LoginSession,
  flowSession: FlowSession,
): Promise<Account> => {
  const {
    cache: { mfaCookieSessionCache },
    logger,
    repository: { accountRepository },
  } = ctx;

  logger.info("Confirming Flow", {
    loginSessionId: loginSession.id,
    flowSessionId: flowSession.id,
    type: flowSession.type,
  });

  logger.debug("Verifying Cookie");

  const cookieId = ctx.getCookie(MFA_COOKIE_NAME);
  const mfaCookie = await mfaCookieSessionCache.find({ id: cookieId });

  if (loginSession.identityId !== mfaCookie.identityId) {
    throw new ClientError("Invalid Cookie", {
      description: "Invalid Identity ID",
    });
  }

  return await accountRepository.find({ id: loginSession.identityId });
};
