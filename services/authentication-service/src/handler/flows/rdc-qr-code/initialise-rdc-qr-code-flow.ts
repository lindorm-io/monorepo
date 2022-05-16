import { ClientError } from "@lindorm-io/errors";
import { ServerKoaContext, FlowHandlerInitialiseOptions } from "../../../types";
import { LoginSession, FlowSession } from "../../../entity";
import { clientCredentialsMiddleware } from "../../../middleware";
import { configuration } from "../../../server/configuration";
import { createURL, getRandomString } from "@lindorm-io/core";
import {
  ClientScope,
  InitialiseRdcSessionRequestData,
  RdcSessionMode,
  RequestMethod,
} from "../../../common";

type Options = FlowHandlerInitialiseOptions;

interface Result {
  qrCode: string;
}

export const initialiseRdcQrCodeFlow = async (
  ctx: ServerKoaContext,
  loginSession: LoginSession,
  flowSession: FlowSession,
  options: Options,
): Promise<Result> => {
  const {
    axios: { deviceLinkClient, oauthClient },
    cache: { flowSessionCache },
    logger,
  } = ctx;

  const { flowToken } = options;

  logger.info("Flow initialised", {
    id: flowSession.id,
    loginSessionId: loginSession.id,
    type: flowSession.type,
    flowToken,
  });

  if (!loginSession.identityId) {
    throw new ClientError("Invalid identifier", {
      description: "Identity ID not found",
    });
  }

  flowSession.nonce = getRandomString(16);

  await flowSessionCache.update(flowSession);

  const data: InitialiseRdcSessionRequestData = {
    clientId: configuration.oauth.client_id,
    confirmMethod: RequestMethod.PUT,
    confirmPayload: { flowToken },
    confirmUri: createURL("/authenticate/flows/:id/confirm", {
      host: configuration.server.host,
      port: configuration.server.port,
      params: { id: flowSession.id },
    }).toString(),
    expiresAt: flowSession.expires.toISOString(),
    mode: RdcSessionMode.QR_CODE,
    nonce: flowSession.nonce,
    rejectMethod: RequestMethod.PUT,
    rejectUri: createURL("/authenticate/flows/:id/reject", {
      host: configuration.server.host,
      port: configuration.server.port,
      params: { id: flowSession.id },
    }).toString(),
    scopes: ["authentication"],
    templateName: "authentication",
  };

  await deviceLinkClient.post("/internal/rdc", {
    data,
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.DEVICE_RDC_WRITE])],
  });

  return { qrCode: "" };
};
