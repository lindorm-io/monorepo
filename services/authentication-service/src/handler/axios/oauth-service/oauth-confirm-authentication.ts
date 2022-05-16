import { LoginSession } from "../../../entity";
import { ServerKoaContext } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import {
  ClientScope,
  ConfirmAuthenticationRequestBody,
  ResponseWithRedirectBody,
} from "../../../common";

export const oauthConfirmAuthentication = async (
  ctx: ServerKoaContext,
  loginSession: LoginSession,
): Promise<ResponseWithRedirectBody> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const body: ConfirmAuthenticationRequestBody = {
    acrValues: [`loa_${loginSession.levelOfAssurance}`],
    amrValues: loginSession.amrValues,
    identityId: loginSession.identityId,
    levelOfAssurance: loginSession.levelOfAssurance,
    remember: loginSession.remember,
  };

  const { data } = await oauthClient.put<ResponseWithRedirectBody>(
    "/internal/sessions/authentication/:id/confirm",
    {
      params: { id: loginSession.oauthSessionId },
      data: body,
      middleware: [
        clientCredentialsMiddleware(oauthClient, [ClientScope.OAUTH_AUTHENTICATION_WRITE]),
      ],
    },
  );

  return data;
};
