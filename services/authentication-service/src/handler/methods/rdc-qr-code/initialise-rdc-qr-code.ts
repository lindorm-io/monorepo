import { AuthenticationSession, StrategySession } from "../../../entity";
import { ClientScope, InitialiseRdcSessionRequestData, RdcSessionMode } from "../../../common";
import { ServerKoaContext } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import { getRdcBody } from "../../../util";
import { randomString } from "@lindorm-io/core";

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

  strategySession.nonce = randomString(16);

  await strategySessionCache.update(strategySession);

  const body: InitialiseRdcSessionRequestData = {
    ...getRdcBody(authenticationSession, strategySession, strategySessionToken),
    mode: RdcSessionMode.QR_CODE,
  };

  await deviceClient.post("/internal/rdc", {
    body,
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.DEVICE_RDC_WRITE])],
  });

  return { qrCode: "QR_CODE" };
};
