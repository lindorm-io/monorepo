import { LoginSession, FlowSession } from "../../../entity";
import { ClientScope, EmitSocketEventRequestData } from "../../../common";
import { ServerError } from "@lindorm-io/errors";
import { clientCredentialsMiddleware } from "../../../middleware";
import { getRandomString } from "@lindorm-io/core";
import { ServerKoaContext, FlowHandlerInitialiseOptions } from "../../../types";

type Options = FlowHandlerInitialiseOptions;

interface Result {
  displayCode: string;
}

export const initialiseSessionAcceptWithCodeFlow = async (
  ctx: ServerKoaContext,
  loginSession: LoginSession,
  flowSession: FlowSession,
  options: Options,
): Promise<Result> => {
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

  flowSession.code = `${getRandomString(4)}-${getRandomString(4)}`.toUpperCase();

  await flowSessionCache.update(flowSession);

  const data: EmitSocketEventRequestData = {
    channels: { sessions: loginSession.sessions },
    content: { id: flowSession.id, flowToken },
    event: "authentication:session-code",
  };

  await communicationClient.post("/internal/socket/emit", {
    data,
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.COMMUNICATION_EVENT_EMIT])],
  });

  return { displayCode: flowSession.code };
};
