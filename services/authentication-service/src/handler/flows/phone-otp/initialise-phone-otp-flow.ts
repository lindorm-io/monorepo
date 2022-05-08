import { LoginSession, FlowSession } from "../../../entity";
import { ClientScope, SendSmsRequestData } from "../../../common";
import { clientCredentialsMiddleware } from "../../../middleware";
import { getExpires } from "@lindorm-io/core";
import { getRandomNumberAsync } from "@lindorm-io/core";
import { Context, FlowHandlerInitialiseOptions } from "../../../types";

interface Options extends FlowHandlerInitialiseOptions {
  phoneNumber: string;
}

export const initialisePhoneOtpFlow = async (
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

  const { flowToken, phoneNumber } = options;

  logger.info("Flow initialised", {
    id: flowSession.id,
    loginSessionId: loginSession.id,
    type: flowSession.type,
    flowToken,
  });

  flowSession.otp = (await getRandomNumberAsync(6)).toString().padStart(6, "0");

  await flowSessionCache.update(flowSession);

  const { expiresIn } = getExpires(flowSession.expires);

  const data: SendSmsRequestData = {
    content: {
      expiresIn,
      otp: flowSession.otp,
    },
    template: "auth-phone-otp",
    to: phoneNumber,
  };

  await communicationClient.post("/internal/send/sms", {
    data,
    middleware: [
      clientCredentialsMiddleware(oauthClient, [ClientScope.COMMUNICATION_MESSAGE_SEND]),
    ],
  });
};
