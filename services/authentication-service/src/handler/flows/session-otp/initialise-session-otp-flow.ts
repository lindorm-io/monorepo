import { ClientScope, EmitSocketEventRequestData } from "../../../common";
import { LoginSession, FlowSession } from "../../../entity";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../../types";
import { argon } from "../../../instance";
import { clientCredentialsMiddleware } from "../../../middleware";
import { getRandomNumberAsync } from "../../../util";

export const initialiseSessionOtpFlow = async (
  ctx: ServerKoaContext,
  loginSession: LoginSession,
  flowSession: FlowSession,
): Promise<void> => {
  const {
    axios: { communicationClient, oauthClient },
    cache: { flowSessionCache },
  } = ctx;

  if (!loginSession.sessions.length) {
    throw new ServerError("Unable to start flow", {
      description: "Unable to find sessions",
    });
  }

  const otp = (await getRandomNumberAsync(6)).toString().padStart(6, "0");
  flowSession.otp = await argon.encrypt(otp);

  await flowSessionCache.update(flowSession);

  const data: EmitSocketEventRequestData = {
    channels: { sessions: loginSession.sessions },
    content: { otp },
    event: "authentication-service:session-otp-flow",
  };

  await communicationClient.post("/internal/socket/emit", {
    data,
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.COMMUNICATION_EVENT_EMIT])],
  });
};
