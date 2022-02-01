import { Context } from "../../../types";
import { Account, LoginSession, FlowSession } from "../../../entity";
import { ServerError } from "@lindorm-io/errors";

interface Options {
  data: any;
}

export const confirmWebauthnFlow = async (
  ctx: Context,
  loginSession: LoginSession,
  flowSession: FlowSession,
  options: Options,
): Promise<Account> => {
  const { logger } = ctx;

  logger.info("Confirming Flow", {
    loginSessionId: loginSession.id,
    flowSessionId: flowSession.id,
    type: flowSession.type,
  });

  console.log(options);

  throw new ServerError("Flow not implemented");
};
