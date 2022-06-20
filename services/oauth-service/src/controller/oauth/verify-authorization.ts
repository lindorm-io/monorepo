import Joi from "joi";
import { AUTHORIZATION_SESSION_COOKIE_NAME } from "../../constant";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, SessionStatus } from "../../common";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";
import { createURL } from "@lindorm-io/core";
import { generateCallbackResponse, setBrowserSessionCookie } from "../../handler";

interface RequestData {
  redirectUri: string;
  sessionId: string;
}

export const oauthVerifyAuthorizationSchema = Joi.object<RequestData>()
  .keys({
    redirectUri: Joi.string().uri().required(),
    sessionId: JOI_GUID,
  })
  .required();

export const oauthVerifyAuthorizationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { redirectUri, sessionId },
    entity: { authorizationSession, browserSession, client },
  } = ctx;

  if (sessionId !== authorizationSession.id) {
    throw new ClientError("Invalid Session ID");
  }

  if (redirectUri !== authorizationSession.redirectUri) {
    throw new ClientError("Invalid Redirect URI");
  }

  if (authorizationSession.browserSessionId !== browserSession.id) {
    throw new ClientError("Invalid Browser Session ID");
  }

  setBrowserSessionCookie(ctx, browserSession);

  if (
    ![SessionStatus.CONFIRMED, SessionStatus.REJECTED, SessionStatus.SKIP].includes(
      authorizationSession.authenticationStatus,
    )
  ) {
    return {
      redirect: createURL(configuration.redirect.login, {
        host: configuration.services.authentication_service.host,
        port: configuration.services.authentication_service.port,
        query: { sessionId: authorizationSession.id },
      }),
    };
  }

  if (
    ![SessionStatus.CONFIRMED, SessionStatus.REJECTED, SessionStatus.SKIP].includes(
      authorizationSession.consentStatus,
    )
  ) {
    return {
      redirect: createURL(configuration.redirect.consent, {
        host: configuration.services.authentication_service.host,
        port: configuration.services.authentication_service.port,
        query: { sessionId: authorizationSession.id },
      }),
    };
  }

  ctx.deleteCookie(AUTHORIZATION_SESSION_COOKIE_NAME);

  return await generateCallbackResponse(ctx, authorizationSession, browserSession, client);
};
