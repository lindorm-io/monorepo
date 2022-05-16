import { LoginSession, FlowSession } from "../../../entity";
import { ServerKoaContext, FlowHandlerInitialiseOptions } from "../../../types";

type Options = FlowHandlerInitialiseOptions;

export const initialisePasswordBrowserLinkFlow = async (
  ctx: ServerKoaContext,
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
