import { LoginSession, FlowSession } from "../../../entity";
import { Context, FlowHandlerInitialiseOptions } from "../../../types";

type Options = FlowHandlerInitialiseOptions;

export const initialisePasswordBrowserLinkFlow = async (
  ctx: Context,
  loginSession: LoginSession,
  flowSession: FlowSession,
  options: Options,
): Promise<void> => {
  const { logger } = ctx;

  const { flowToken } = options;

  logger.info("Flow initialised", {
    id: flowSession.id,
    loginSessionId: loginSession.id,
    type: flowSession.type,
    flowToken,
  });
};
