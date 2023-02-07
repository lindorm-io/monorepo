import { AuthenticationSession, StrategySession } from "../../../entity";
import { AuthenticationStrategyConfig } from "../../../constant";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../../types";
import { argon } from "../../../instance";
import { clientCredentialsMiddleware } from "../../../middleware";
import { randomNumberAsync } from "../../../util";
import { getValidIdentitySessions } from "../../authentication";
import { EmitSocketEventRequestBody } from "@lindorm-io/common-types";
import { ClientScopes } from "../../../common";

export const initialiseSessionOtp = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
  strategySession: StrategySession,
  config: AuthenticationStrategyConfig,
): Promise<void> => {
  const {
    axios: { communicationClient, oauthClient },
    cache: { strategySessionCache },
  } = ctx;

  if (!authenticationSession.identityId) {
    throw new ClientError("Invalid identifier", {
      description: "Identity ID not found",
    });
  }

  const otp = (await randomNumberAsync(config.confirmLength))
    .toString()
    .padStart(config.confirmLength, "0");

  strategySession.otp = await argon.encrypt(otp);

  await strategySessionCache.update(strategySession);

  const sessions = await getValidIdentitySessions(ctx, authenticationSession.identityId);

  if (!sessions.length) {
    throw new ServerError("Bad Request", {
      description: "Unable to find sessions",
    });
  }

  const body: EmitSocketEventRequestBody = {
    channels: { sessions },
    content: { otp },
    event: "authentication-service:session-otp-flow",
  };

  await communicationClient.post("/internal/socket/emit", {
    body,
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScopes.COMMUNICATION_EVENT_EMIT])],
  });
};
