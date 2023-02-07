import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import { ClientScopes, JOI_JWT } from "../../../common";
import {
  AuthenticationMethod,
  ConfirmLoginRequestBody,
  ConfirmLoginResponse,
} from "@lindorm-io/common-types";

interface RequestData {
  id: string;
  authenticationConfirmationToken: string;
}

export const confirmLoginSessionSchema = Joi.object<RequestData>({
  id: Joi.string().guid().required(),
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

  const { data } = await oauthClient.post<ConfirmLoginResponse>(
    "/internal/sessions/login/:id/confirm",
    {
      params: { id: authenticationConfirmationToken.sessionId },
      body,
      middleware: [
        clientCredentialsMiddleware(oauthClient, [ClientScopes.OAUTH_AUTHENTICATION_WRITE]),
      ],
    },
  );

  return { body: data };
};
