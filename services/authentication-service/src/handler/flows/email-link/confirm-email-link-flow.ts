import { Account, LoginSession, FlowSession } from "../../../entity";
import { ClientError } from "@lindorm-io/errors";
import { Context } from "../../../types";
import { identityAuthenticateIdentifier } from "../../axios";

interface Options {
  code: string;
}

export const confirmEmailLinkFlow = async (
  ctx: Context,
  loginSession: LoginSession,
  flowSession: FlowSession,
  options: Options,
): Promise<Account> => {
  const {
    logger,
    repository: { accountRepository },
  } = ctx;

  const { code } = options;

  logger.info("Confirming Flow", {
    loginSessionId: loginSession.id,
    flowSessionId: flowSession.id,
    type: flowSession.type,
  });

  logger.debug("Verifying Code");

  if (code !== flowSession.code) {
    throw new ClientError("Invalid Code");
  }

  logger.debug("Verifying Identity");

  const { identityId } = await identityAuthenticateIdentifier(ctx, loginSession, flowSession);

  logger.debug("Resolving Account");

  return await accountRepository.findOrCreate({ id: identityId });
};
