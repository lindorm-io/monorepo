import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import { configuration } from "../../../server/configuration";
import { createURL } from "@lindorm-io/url";
import { fetchOauthLoginData } from "../../../handler";
import { ClientScopes } from "../../../common";
import {
  AuthenticationMethod,
  ConfirmLoginRequestBody,
  ConfirmLoginResponse,
  LindormTokenTypes,
  RedirectLoginResponse,
  SessionStatuses,
} from "@lindorm-io/common-types";

interface RequestData {
  sessionId: string;
}

export const redirectLoginSessionSchema = Joi.object<RequestData>()
  .keys({
    sessionId: Joi.string().guid().required(),
  })
  .required();

export const redirectLoginSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    axios: { oauthClient },
    data: { sessionId },
    jwt,
    logger,
  } = ctx;

  const {
    loginStatus,
    authorizationSession: { authToken },
  } = await fetchOauthLoginData(ctx, sessionId);

  if (loginStatus !== SessionStatuses.PENDING) {
    logger.warn("Invalid Session Status", { loginStatus });

    const {
      data: { redirectTo },
    } = await oauthClient.get<RedirectLoginResponse>("/internal/sessions/login/:id/redirect", {
      params: { id: sessionId },
    });

    return { redirect: redirectTo };
  }

  if (authToken) {
    try {
      const authenticationConfirmationToken = jwt.verify(authToken, {
        issuer: configuration.server.issuer,
        types: [LindormTokenTypes.AUTHENTICATION_CONFIRMATION],
      });

      const body: ConfirmLoginRequestBody = {
        acrValues: authenticationConfirmationToken.authContextClass,
        amrValues:
          authenticationConfirmationToken.authMethodsReference as Array<AuthenticationMethod>,
        identityId: authenticationConfirmationToken.subject,
        levelOfAssurance: authenticationConfirmationToken.levelOfAssurance,
        remember: authenticationConfirmationToken.claims.remember,
      };

      const {
        data: { redirectTo },
      } = await oauthClient.post<ConfirmLoginResponse>("/internal/sessions/login/:id/confirm", {
        params: { id: sessionId },
        body,
        middleware: [
          clientCredentialsMiddleware(oauthClient, [ClientScopes.OAUTH_AUTHENTICATION_WRITE]),
        ],
      });

      return { redirect: redirectTo };
    } catch (err: any) {
      /* ignored */
    }
  }

  return {
    redirect: createURL(configuration.frontend.routes.login, {
      host: configuration.frontend.host,
      port: configuration.frontend.port,
      query: { sessionId },
    }),
  };
};
