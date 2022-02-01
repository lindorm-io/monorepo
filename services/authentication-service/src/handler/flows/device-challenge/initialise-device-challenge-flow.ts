import { LoginSession, FlowSession } from "../../../entity";
import { Context, FlowHandlerInitialiseOptions } from "../../../types";

export const initialiseDeviceChallengeFlow = async (
  ctx: Context,
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
