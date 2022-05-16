import { LoginSession, FlowSession } from "../../../entity";
import { ClientScope, SendEmailRequestData } from "../../../common";
import { clientCredentialsMiddleware } from "../../../middleware";
import { getExpires } from "@lindorm-io/core";
import { getRandomString } from "@lindorm-io/core";
import { ServerKoaContext, FlowHandlerInitialiseOptions } from "../../../types";

interface Options extends FlowHandlerInitialiseOptions {
  email: string;
}

export const initialiseEmailLinkFlow = async (
  ctx: ServerKoaContext,
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

  const data: SendEmailRequestData = {
    content: {
      code: flowSession.code,
      expiresIn,
      flowToken,
    },
    template: "auth-email-link",
    to: email,
  };

  await communicationClient.post("/internal/send/email", {
    data,
    middleware: [
      clientCredentialsMiddleware(oauthClient, [ClientScope.COMMUNICATION_MESSAGE_SEND]),
    ],
  });
};
