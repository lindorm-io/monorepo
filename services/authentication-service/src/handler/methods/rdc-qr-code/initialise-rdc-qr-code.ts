import { AuthenticationSession, StrategySession } from "../../../entity";
import { ServerKoaContext } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import { getRdcBody } from "../../../util";
import { randomString } from "@lindorm-io/random";
import { ClientScopes } from "../../../common";
import {
  AuthStrategyInitialisation,
  InitialiseRdcSessionRequestBody,
  RdcSessionModes,
} from "@lindorm-io/common-types";

interface Options {
  strategySessionToken: string;
}

export const initialiseRdcQrCode = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
  strategySession: StrategySession,
  options: Options,
): Promise<AuthStrategyInitialisation> => {
  const {
    axios: { deviceClient, oauthClient },
    cache: { strategySessionCache },
  } = ctx;

  const { strategySessionToken } = options;

  strategySession.nonce = randomString(16);

  await strategySessionCache.update(strategySession);

  const body: InitialiseRdcSessionRequestBody = {
    ...getRdcBody(authenticationSession, strategySession, strategySessionToken),
    mode: RdcSessionModes.QR_CODE,
  };

  await deviceClient.post("/internal/rdc", {
    body,
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScopes.DEVICE_RDC_WRITE])],
  });

  return {
    displayCode: null,
    qrCode: "QR_CODE",
  };
};
