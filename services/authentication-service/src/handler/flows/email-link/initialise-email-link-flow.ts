import { ClientScope, SendCodeRequestData } from "../../../common";
import { LoginSession, FlowSession } from "../../../entity";
import { ServerKoaContext } from "../../../types";
import { argon } from "../../../instance";
import { clientCredentialsMiddleware } from "../../../middleware";
import { configuration } from "../../../server/configuration";
import { createURL } from "@lindorm-io/core";
import { getRandomString } from "@lindorm-io/core";

interface Options {
  email: string;
  flowToken: string;
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
  } = ctx;

  const { email, flowToken } = options;

  const code = getRandomString(64);
  flowSession.code = await argon.encrypt(code);

  await flowSessionCache.update(flowSession);

  const url = createURL(configuration.frontend.routes.code_callback, {
    host: configuration.frontend.host,
    port: configuration.frontend.port,
    query: {
      code,
      token: flowToken,
    },
  });

  const data: SendCodeRequestData = {
    content: {
      expires: flowSession.expires,
      url: url.toString(),
    },
    template: "authentication-email-link-flow",
    to: email,
    type: "email",
  };

  await communicationClient.post("/internal/send/code", {
    data,
    middleware: [
      clientCredentialsMiddleware(oauthClient, [ClientScope.COMMUNICATION_MESSAGE_SEND]),
    ],
  });
};
