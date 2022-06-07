import { ClientScope, SendCodeRequestData } from "../../../common";
import { LoginSession, FlowSession } from "../../../entity";
import { ServerKoaContext, FlowHandlerInitialiseOptions } from "../../../types";
import { argon } from "../../../instance";
import { clientCredentialsMiddleware } from "../../../middleware";
import { getRandomNumberAsync } from "../../../util";

interface Options extends FlowHandlerInitialiseOptions {
  phoneNumber: string;
}

export const initialisePhoneOtpFlow = async (
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

  const { flowToken, phoneNumber } = options;

  logger.info("Flow initialised", {
    id: flowSession.id,
    loginSessionId: loginSession.id,
    type: flowSession.type,
    flowToken,
  });

  const otp = (await getRandomNumberAsync(6)).toString().padStart(6, "0");
  flowSession.otp = await argon.encrypt(otp);

  await flowSessionCache.update(flowSession);

  const data: SendCodeRequestData = {
    content: {
      expires: flowSession.expires,
      otp,
    },
    template: "authentication-phone-otp-flow",
    to: phoneNumber,
    type: "phone",
  };

  await communicationClient.post("/internal/send/otp", {
    data,
    middleware: [
      clientCredentialsMiddleware(oauthClient, [ClientScope.COMMUNICATION_MESSAGE_SEND]),
    ],
  });
};
