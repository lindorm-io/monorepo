import Joi from "joi";
import { AuthenticationMethod, ConfirmElevationRequestBody } from "@lindorm-io/common-types";
import { ClientScopes, JOI_JWT } from "../../../common";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";

interface RequestData {
  id: string;
  authenticationConfirmationToken: string;
}

export const confirmElevationSessionSchema = Joi.object<RequestData>({
  id: Joi.string().guid().required(),
  authenticationConfirmationToken: JOI_JWT.required(),
});

export const confirmElevationSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    axios: { oauthClient },
    token: { authenticationConfirmationToken },
  } = ctx;

  const body: ConfirmElevationRequestBody = {
    acrValues: authenticationConfirmationToken.authContextClass,
    amrValues: authenticationConfirmationToken.authMethodsReference as Array<AuthenticationMethod>,
    identityId: authenticationConfirmationToken.subject,
    levelOfAssurance: authenticationConfirmationToken.levelOfAssurance,
  };

  await oauthClient.post("/internal/sessions/elevation/:id/confirm", {
    params: { id: authenticationConfirmationToken.sessionId },
    body,
    middleware: [
      clientCredentialsMiddleware(oauthClient, [ClientScopes.OAUTH_AUTHENTICATION_WRITE]),
    ],
  });
};
