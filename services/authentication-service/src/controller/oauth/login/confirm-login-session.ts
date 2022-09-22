import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import {
  AuthenticationMethod,
  ClientScope,
  ConfirmLoginRequestBody,
  JOI_GUID,
  JOI_JWT,
  ResponseWithRedirectBody,
} from "../../../common";

interface RequestData {
  id: string;
  authenticationConfirmationToken: string;
}

export const confirmLoginSessionSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
  authenticationConfirmationToken: JOI_JWT.required(),
});

export const confirmLoginSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    axios: { oauthClient },
    token: { authenticationConfirmationToken },
  } = ctx;

  const body: ConfirmLoginRequestBody = {
    acrValues: authenticationConfirmationToken.authContextClass,
    amrValues: authenticationConfirmationToken.authMethodsReference as Array<AuthenticationMethod>,
    identityId: authenticationConfirmationToken.subject,
    levelOfAssurance: authenticationConfirmationToken.levelOfAssurance,
    remember: authenticationConfirmationToken.claims.remember,
  };

  const { data } = await oauthClient.post<ResponseWithRedirectBody>(
    "/internal/sessions/login/:id/confirm",
    {
      params: { id: authenticationConfirmationToken.sessionId },
      body,
      middleware: [
        clientCredentialsMiddleware(oauthClient, [ClientScope.OAUTH_AUTHENTICATION_WRITE]),
      ],
    },
  );

  return { body: data };
};
