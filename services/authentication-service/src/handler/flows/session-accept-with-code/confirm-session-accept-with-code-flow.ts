import { Context } from "../../../types";
import { Account, LoginSession, FlowSession } from "../../../entity";
import { ClientError } from "@lindorm-io/errors";

interface Options {
  code: string;
}

export const confirmSessionAcceptWithCodeFlow = async (
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

  logger.debug("Resolving Account");

  return await accountRepository.find({ id: loginSession.identityId });
};
