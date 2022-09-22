import { AuthenticationSession, StrategySession } from "../../../entity";
import { ClientError } from "@lindorm-io/errors";
import { ClientScope, InitialiseRdcSessionRequestData, RdcSessionMode } from "../../../common";
import { ServerKoaContext } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import { getRdcBody } from "../../../util";
import { randomString } from "@lindorm-io/core";

interface Options {
  strategySessionToken: string;
}

export const initialiseRdcPushNotification = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
  strategySession: StrategySession,
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

  const body: InitialiseRdcSessionRequestData = {
    ...getRdcBody(authenticationSession, strategySession, strategySessionToken),
    mode: RdcSessionMode.PUSH_NOTIFICATION,
  };

  await deviceClient.post("/internal/rdc", {
    body,
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.DEVICE_RDC_WRITE])],
  });
};
