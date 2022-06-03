import { ClientScope, EmitSocketEventRequestData } from "../../../common";
import { LoginSession, FlowSession } from "../../../entity";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext, FlowHandlerInitialiseOptions } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import { getRandomNumberAsync } from "../../../util";

type Options = FlowHandlerInitialiseOptions;

export const initialiseSessionOtpFlow = async (
  ctx: ServerKoaContext,
  loginSession: LoginSession,
  flowSession: FlowSession,
  options: Options,
): Promise<void> => {
  const {
    axios: { communicationClient, oauthClient },
    cache: { flowSessionCache },
    logger,
  } = ctx;

  const { flowToken } = options;

  logger.info("Flow initialised", {
    id: flowSession.id,
    loginSessionId: loginSession.id,
    type: flowSession.type,
    flowToken,
  });

  if (!loginSession.sessions.length) {
    throw new ServerError("Unable to start flow", {
      description: "Unable to find sessions",
    });
  }

  flowSession.otp = (await getRandomNumberAsync(6)).toString().padStart(6, "0");

  await flowSessionCache.update(flowSession);

  const data: EmitSocketEventRequestData = {
    channels: { sessions: loginSession.sessions },
    content: { otp: flowSession.otp },
    event: "authentication:session-otp",
  };

  await communicationClient.post("/internal/socket/emit", {
    data,
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.COMMUNICATION_EVENT_EMIT])],
  });
};
