import { ClientScope, SendCodeRequestData } from "../../common";
import { ConnectSession, Identifier } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { configuration } from "../../server/configuration";
import { createURL } from "@lindorm-io/url";
import { isIdentifierStoredSeparately } from "../../util";

export const sendConnectSessionMessage = async (
  ctx: ServerKoaContext,
  identifier: Identifier,
  connectSession: ConnectSession,
  code: string,
): Promise<void> => {
  const {
    axios: { communicationClient, oauthClient },
  } = ctx;

  if (!isIdentifierStoredSeparately(identifier.type)) {
    throw new ServerError("Invalid identifier type", {
      debug: { type: identifier.type },
    });
  }

  const body: SendCodeRequestData = {
    content: {
      expires: connectSession.expires,
      url: createURL(configuration.frontend.routes.connect_callback, {
        host: configuration.frontend.host,
        port: configuration.frontend.port,
        query: {
          code,
          sessionId: connectSession.id,
        },
      }).toString(),
    },
    template: "identifier-connect-session",
    to: identifier.identifier,
    type: identifier.type,
  };

  await communicationClient.post("/internal/send/code", {
    body,
    middleware: [
      clientCredentialsMiddleware(oauthClient, [ClientScope.COMMUNICATION_MESSAGE_SEND]),
    ],
  });
};
