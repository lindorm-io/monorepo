import { ClientScope, SendCodeRequestData } from "../../../common";
import { LoginSession, FlowSession } from "../../../entity";
import { ServerKoaContext } from "../../../types";
import { argon } from "../../../instance";
import { clientCredentialsMiddleware } from "../../../middleware";
import { getRandomNumberAsync } from "../../../util";

interface Options {
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
  } = ctx;

  const { email } = options;

  const otp = (await getRandomNumberAsync(6)).toString().padStart(6, "0");
  flowSession.otp = await argon.encrypt(otp);

  await flowSessionCache.update(flowSession);

  const data: SendCodeRequestData = {
    content: {
      expires: flowSession.expires,
      otp,
    },
    template: "authentication-email-otp-flow",
    to: email,
    type: "email",
  };

  await communicationClient.post("/internal/send/otp", {
    data,
    middleware: [
      clientCredentialsMiddleware(oauthClient, [ClientScope.COMMUNICATION_MESSAGE_SEND]),
    ],
  });
};
