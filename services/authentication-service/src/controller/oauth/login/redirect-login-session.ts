import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import { configuration } from "../../../server/configuration";
import { createURL } from "@lindorm-io/url";
import { fetchOauthLoginData } from "../../../handler";
import {
  AuthenticationMethod,
  ClientScope,
  ConfirmLoginRequestBody,
  JOI_GUID,
  ResponseWithRedirectBody,
  SessionStatus,
  TokenType,
} from "../../../common";

interface RequestData {
  sessionId: string;
}

export const redirectLoginSessionSchema = Joi.object<RequestData>()
  .keys({
    sessionId: JOI_GUID.required(),
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

  if (loginStatus !== SessionStatus.PENDING) {
    logger.warn("Invalid Session Status", { loginStatus });

    const {
      data: { redirectTo },
    } = await oauthClient.get<ResponseWithRedirectBody>("/internal/sessions/login/:id/verify", {
      params: { id: sessionId },
    });

    return { redirect: redirectTo };
  }

  if (authToken) {
    try {
      const authenticationConfirmationToken = jwt.verify(authToken, {
        issuer: configuration.server.issuer,
        types: [TokenType.AUTHENTICATION_CONFIRMATION],
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
      } = await oauthClient.post<ResponseWithRedirectBody>("/internal/sessions/login/:id/confirm", {
        params: { id: sessionId },
        body,
        middleware: [
          clientCredentialsMiddleware(oauthClient, [ClientScope.OAUTH_AUTHENTICATION_WRITE]),
        ],
      });

      return { redirect: redirectTo };
    } catch (err) {
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
