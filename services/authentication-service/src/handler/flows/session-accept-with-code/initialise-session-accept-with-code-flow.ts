import { ClientScope, EmitSocketEventRequestData } from "../../../common";
import { LoginSession, FlowSession } from "../../../entity";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../../types";
import { argon } from "../../../instance";
import { clientCredentialsMiddleware } from "../../../middleware";
import { getRandomString } from "@lindorm-io/core";

interface Options {
  flowToken: string;
}

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
  } = ctx;

  const { flowToken } = options;

  if (!loginSession.sessions.length) {
    throw new ServerError("Unable to start flow", {
      description: "Unable to find sessions",
    });
  }

  const code = `${getRandomString(4)}-${getRandomString(4)}`.toUpperCase();
  flowSession.code = await argon.encrypt(code);

  await flowSessionCache.update(flowSession);

  const data: EmitSocketEventRequestData = {
    channels: { sessions: loginSession.sessions },
    content: { id: flowSession.id, flowToken },
    event: "authentication-service:session-accept-with-code-flow",
  };

  await communicationClient.post("/internal/socket/emit", {
    data,
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.COMMUNICATION_EVENT_EMIT])],
  });

  return { displayCode: code };
};
