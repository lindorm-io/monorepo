import { LoginSession, FlowSession } from "../../../entity";
import { ClientScope } from "../../../common";
import { Context, FlowHandlerInitialiseOptions } from "../../../types";
import { ServerError } from "@lindorm-io/errors";
import { clientCredentialsMiddleware } from "../../../middleware";
import { getRandomNumberAsync } from "@lindorm-io/core";

type Options = FlowHandlerInitialiseOptions;

export const initialiseSessionOtpFlow = async (
  ctx: Context,
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

  await communicationClient.post("/internal/socket/emit", {
    data: {
      channels: {
        sessions: loginSession.sessions,
      },
      content: {
        otp: flowSession.otp,
      },
      event: "authentication:session-otp",
    },
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.COMMUNICATION_EVENT_EMIT])],
  });
};
