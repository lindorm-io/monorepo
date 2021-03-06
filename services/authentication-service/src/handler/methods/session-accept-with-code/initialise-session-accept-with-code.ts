import { AuthenticationSession, StrategySession } from "../../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { EmitSocketEventRequestData } from "../../../common";
import { ServerKoaContext } from "../../../types";
import { argon } from "../../../instance";
import { clientCredentialsMiddleware } from "../../../middleware";
import { randomString } from "@lindorm-io/core";
import { getValidIdentitySessions } from "../../authentication";

interface Options {
  strategySessionToken: string;
}

interface Result {
  displayCode: string;
}

export const initialiseSessionAcceptWithCode = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
  strategySession: StrategySession,
  options: Options,
): Promise<Result> => {
  const {
    axios: { communicationClient, oauthClient },
    cache: { strategySessionCache },
  } = ctx;

  const { strategySessionToken } = options;

  if (!authenticationSession.identityId) {
    throw new ClientError("Invalid identifier", {
      description: "Identity ID not found",
    });
  }

  const code = `${randomString(4)}-${randomString(4)}`.toUpperCase();
  strategySession.code = await argon.encrypt(code);

  await strategySessionCache.update(strategySession);

  const sessions = await getValidIdentitySessions(ctx, authenticationSession.identityId);

  if (!sessions.length) {
    throw new ServerError("Bad Request", {
      description: "Unable to find sessions",
    });
  }

  const body: EmitSocketEventRequestData = {
    channels: { sessions },
    content: { id: authenticationSession.id, strategySessionToken },
    event: "authentication-service:session-accept-with-code",
  };

  await communicationClient.post("/internal/socket/emit", {
    body,
    middleware: [clientCredentialsMiddleware(oauthClient)],
  });

  return { displayCode: code };
};
