import { LoginSession, FlowSession } from "../../../entity";
import { ServerError } from "@lindorm-io/errors";
import { Context, FlowHandlerInitialiseOptions } from "../../../types";

type Options = FlowHandlerInitialiseOptions;

type Result = Record<string, unknown>;

export const initialiseWebauthnFlow = async (
  ctx: Context,
  loginSession: LoginSession,
  flowSession: FlowSession,
  options: Options,
): Promise<Result> => {
  const { logger } = ctx;

  const { flowToken } = options;

  logger.info("Flow initialised", {
    id: flowSession.id,
    loginSessionId: loginSession.id,
    type: flowSession.type,
    flowToken,
  });

  throw new ServerError("Flow not implemented");
};
