import { AuthenticationSession, StrategySession } from "../../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { EmitSocketEventRequestData } from "../../../common";
import { ServerKoaContext } from "../../../types";
import { argon } from "../../../instance";
import { clientCredentialsMiddleware } from "../../../middleware";
import { getRandomNumberAsync } from "../../../util";
import { getValidIdentitySessions } from "../../authentication";

export const initialiseSessionOtp = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
  strategySession: StrategySession,
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

  const otp = (await getRandomNumberAsync(6)).toString().padStart(6, "0");
  strategySession.otp = await argon.encrypt(otp);

  await strategySessionCache.update(strategySession);

  const sessions = await getValidIdentitySessions(ctx, authenticationSession.identityId);

  if (!sessions.length) {
    throw new ServerError("Bad Request", {
      description: "Unable to find sessions",
    });
  }

  const body: EmitSocketEventRequestData = {
    channels: { sessions },
    content: { otp },
    event: "authentication-service:session-otp-flow",
  };

  await communicationClient.post("/internal/socket/emit", {
    body,
    middleware: [clientCredentialsMiddleware(oauthClient)],
  });
};
