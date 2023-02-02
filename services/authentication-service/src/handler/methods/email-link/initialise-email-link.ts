import { ClientScope, SendCodeRequestData } from "../../../common";
import { ServerKoaContext } from "../../../types";
import { StrategySession } from "../../../entity";
import { argon } from "../../../instance";
import { clientCredentialsMiddleware } from "../../../middleware";
import { configuration } from "../../../server/configuration";
import { createURL } from "@lindorm-io/url";
import { randomString } from "@lindorm-io/random";

interface Options {
  strategySessionToken: string;
  email: string;
}

export const initialiseEmailLink = async (
  ctx: ServerKoaContext,
  strategySession: StrategySession,
  options: Options,
): Promise<void> => {
  const {
    cache: { strategySessionCache },
    axios: { communicationClient, oauthClient },
  } = ctx;

  const { strategySessionToken, email } = options;

  const code = randomString(64);
  strategySession.code = await argon.encrypt(code);

  await strategySessionCache.update(strategySession);

  const url = createURL(configuration.frontend.routes.code_callback, {
    host: configuration.frontend.host,
    port: configuration.frontend.port,
    query: { strategySessionToken, code },
  });

  const body: SendCodeRequestData = {
    content: {
      expires: strategySession.expires,
      url: url.toString(),
    },
    template: "authentication-email-link",
    to: email,
    type: "email",
  };

  await communicationClient.post("/internal/send/code", {
    body,
    middleware: [
      clientCredentialsMiddleware(oauthClient, [ClientScope.COMMUNICATION_MESSAGE_SEND]),
    ],
  });
};
