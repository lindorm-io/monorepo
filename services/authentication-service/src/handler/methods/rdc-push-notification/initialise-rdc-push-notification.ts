import { AuthenticationSession, StrategySession } from "../../../entity";
import { ClientError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import { getRdcBody } from "../../../util";
import { randomString } from "@lindorm-io/random";
import { AuthenticationStrategyConfig } from "../../../constant";
import { InitialiseRdcSessionRequestBody, RdcSessionModes } from "@lindorm-io/common-types";
import { ClientScopes } from "../../../common";

interface Options {
  strategySessionToken: string;
}

export const initialiseRdcPushNotification = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
  strategySession: StrategySession,
  config: AuthenticationStrategyConfig,
  options: Options,
): Promise<void> => {
  const {
    axios: { deviceClient, oauthClient },
    cache: { strategySessionCache },
  } = ctx;

  const { strategySessionToken } = options;

  if (!authenticationSession.identityId) {
    throw new ClientError("Invalid identifier", {
      description: "Identity ID not found",
    });
  }

  strategySession.nonce = randomString(16);

  await strategySessionCache.update(strategySession);

  const body: InitialiseRdcSessionRequestBody = {
    ...getRdcBody(authenticationSession, strategySession, strategySessionToken),
    mode: RdcSessionModes.PUSH_NOTIFICATION,
  };

  await deviceClient.post("/internal/rdc", {
    body,
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScopes.DEVICE_RDC_WRITE])],
  });
};
