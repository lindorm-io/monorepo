import { AuthenticationSession, StrategySession } from "../../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../../types";
import { argon } from "../../../instance";
import { clientCredentialsMiddleware } from "../../../middleware";
import { randomString } from "@lindorm-io/random";
import { getValidIdentitySessions } from "../../authentication";
import { AuthenticationStrategyConfig } from "../../../constant";
import { AuthStrategyInitialisation, EmitSocketEventRequestBody } from "@lindorm-io/common-types";
import { ClientScopes } from "../../../common";

interface Options {
  strategySessionToken: string;
}

export const initialiseSessionAcceptWithCode = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
  strategySession: StrategySession,
  config: AuthenticationStrategyConfig,
  options: Options,
): Promise<AuthStrategyInitialisation> => {
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

  if (!config.confirmLength) {
    throw new ServerError("Invalid config", {
      debug: { confirmLength: config.confirmLength },
    });
  }

  const code = randomString(config.confirmLength).toUpperCase();

  strategySession.code = await argon.encrypt(code);

  await strategySessionCache.update(strategySession);

  const sessions = await getValidIdentitySessions(ctx, authenticationSession.identityId);

  if (!sessions.length) {
    throw new ServerError("Bad Request", {
      description: "Unable to find sessions",
    });
  }

  const body: EmitSocketEventRequestBody = {
    channels: { sessions },
    content: { id: authenticationSession.id, strategySessionToken },
    event: "authentication-service:session-accept-with-code",
  };

  await communicationClient.post("/internal/socket/emit", {
    body,
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScopes.COMMUNICATION_EVENT_EMIT])],
  });

  return {
    displayCode: code,
    qrCode: null,
  };
};
