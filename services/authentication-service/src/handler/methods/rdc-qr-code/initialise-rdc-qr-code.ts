import { AuthenticationSession, StrategySession } from "../../../entity";
import { ClientError } from "@lindorm-io/errors";
import { InitialiseRdcSessionRequestData, RdcSessionMode, RequestMethod } from "../../../common";
import { ServerKoaContext } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import { configuration } from "../../../server/configuration";
import { createURL, getRandomString } from "@lindorm-io/core";

interface Options {
  strategySessionToken: string;
}

interface Result {
  qrCode: string;
}

export const initialiseRdcQrCode = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
  strategySession: StrategySession,
  options: Options,
): Promise<Result> => {
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

  strategySession.nonce = getRandomString(16);

  await strategySessionCache.update(strategySession);

  const body: InitialiseRdcSessionRequestData = {
    clientId: configuration.oauth.client_id,
    confirmMethod: RequestMethod.PUT,
    confirmPayload: { strategySessionToken },
    confirmUri: createURL("/authenticate/flows/:id/confirm", {
      host: configuration.server.host,
      port: configuration.server.port,
      params: { id: authenticationSession.id },
    }).toString(),
    expiresAt: authenticationSession.expires.toISOString(),
    mode: RdcSessionMode.QR_CODE,
    nonce: strategySession.nonce,
    rejectMethod: RequestMethod.PUT,
    rejectUri: createURL("/authenticate/flows/:id/reject", {
      host: configuration.server.host,
      port: configuration.server.port,
      params: { id: authenticationSession.id },
    }).toString(),
    scopes: ["authentication"],
    templateName: "authentication",
  };

  await deviceClient.post("/internal/rdc", {
    body,
    middleware: [clientCredentialsMiddleware(oauthClient)],
  });

  return { qrCode: "QR_CODE" };
};
