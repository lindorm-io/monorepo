import { ConnectSession, Identifier } from "../../entity";
import { SendCodeRequestData } from "../../common";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { isIdentifierStoredSeparately } from "../../util";
import { createURL } from "@lindorm-io/core";
import { configuration } from "../../server/configuration";

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

  const { expires } = connectSession;

  const url = createURL(configuration.frontend.routes.connect_callback, {
    host: configuration.frontend.host,
    port: configuration.frontend.port,
    query: {
      code,
      sessionId: connectSession.id,
    },
  });

  const body: SendCodeRequestData = {
    content: { expires, url: url.toString() },
    template: "identifier-connect-session",
    to: identifier.identifier,
    type: identifier.type,
  };

  await communicationClient.post("/internal/send/code", {
    body,
    middleware: [clientCredentialsMiddleware(oauthClient)],
  });
};
