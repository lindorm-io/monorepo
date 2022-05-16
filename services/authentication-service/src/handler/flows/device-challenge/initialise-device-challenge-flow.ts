import { LoginSession, FlowSession } from "../../../entity";
import { ServerKoaContext, FlowHandlerInitialiseOptions } from "../../../types";

export const initialiseDeviceChallengeFlow = async (
  ctx: ServerKoaContext,
  loginSession: LoginSession,
  flowSession: FlowSession,
  options: FlowHandlerInitialiseOptions,
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
