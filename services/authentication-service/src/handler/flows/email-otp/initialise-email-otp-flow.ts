import { ClientScope, SendEmailRequestData } from "../../../common";
import { LoginSession, FlowSession } from "../../../entity";
import { clientCredentialsMiddleware } from "../../../middleware";
import { getExpires } from "@lindorm-io/core";
import { getRandomNumberAsync } from "@lindorm-io/core";
import { ServerKoaContext, FlowHandlerInitialiseOptions } from "../../../types";

interface Options extends FlowHandlerInitialiseOptions {
  email: string;
}

export const initialiseEmailOtpFlow = async (
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

  flowSession.otp = (await getRandomNumberAsync(6)).toString().padStart(6, "0");

  await flowSessionCache.update(flowSession);

  const { expiresIn } = getExpires(flowSession.expires);

  const data: SendEmailRequestData = {
    content: {
      expiresIn,
      otp: flowSession.otp,
    },
    template: "auth-email-otp",
    to: email,
  };

  await communicationClient.post("/internal/send/email", {
    data,
    middleware: [
      clientCredentialsMiddleware(oauthClient, [ClientScope.COMMUNICATION_MESSAGE_SEND]),
    ],
  });
};
