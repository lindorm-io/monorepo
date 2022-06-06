import { ConnectSession, Identifier } from "../../entity";
import { SendCodeRequestData } from "../../common";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
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

  const { expires } = connectSession;

  const data: SendCodeRequestData = {
    content: { code, expires, sessionId: connectSession.id },
    template: `identifier-connect-session-${identifier.type}`,
    to: identifier.identifier,
    type: identifier.type,
  };

  await communicationClient.post("/internal/send/code", {
    data,
    middleware: [clientCredentialsMiddleware(oauthClient)],
  });
};
