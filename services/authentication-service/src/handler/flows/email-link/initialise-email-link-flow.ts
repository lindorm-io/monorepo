import { LoginSession, FlowSession } from "../../../entity";
import { ClientScope } from "../../../common";
import { clientCredentialsMiddleware } from "../../../middleware";
import { getExpires } from "@lindorm-io/core";
import { getRandomString } from "@lindorm-io/core";
import { Context, FlowHandlerInitialiseOptions } from "../../../types";

interface Options extends FlowHandlerInitialiseOptions {
  email: string;
}

export const initialiseEmailLinkFlow = async (
  ctx: Context,
  loginSession: LoginSession,
  flowSession: FlowSession,
  options: Options,
): Promise<void> => {
  const {
    cache: { flowSessionCache },
    axios: { communicationClient, oauthClient },
    logger,
  } = ctx;

  const { flowToken, email } = options;

  logger.info("Flow initialised", {
    id: flowSession.id,
    loginSessionId: loginSession.id,
    type: flowSession.type,
    flowToken,
  });

  flowSession.code = getRandomString(64);

  await flowSessionCache.update(flowSession);

  const { expiresIn } = getExpires(flowSession.expires);

  await communicationClient.post("/internal/send/email", {
    data: {
      code: flowSession.code,
      email,
      expiresIn,
      template: "auth-email-link",
      flowToken,
    },
    middleware: [
      clientCredentialsMiddleware(oauthClient, [ClientScope.COMMUNICATION_MESSAGE_SEND]),
    ],
  });
};
