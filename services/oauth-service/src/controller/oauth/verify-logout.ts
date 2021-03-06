import Joi from "joi";
import { BROWSER_SESSION_COOKIE_NAME, LOGOUT_SESSION_COOKIE_NAME } from "../../constant";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, SessionStatus } from "../../common";
import { LogoutSessionType } from "../../enum";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";
import { createURL } from "@lindorm-io/core";

interface RequestData {
  redirectUri: string;
  sessionId: string;
}

export const oauthVerifyLogoutSchema = Joi.object<RequestData>()
  .keys({
    redirectUri: Joi.string().uri().required(),
    sessionId: JOI_GUID,
  })
  .required();

export const oauthVerifyLogoutController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { redirectUri, sessionId },
    entity: { logoutSession },
  } = ctx;

  if (sessionId !== logoutSession.id) {
    throw new ClientError("Invalid Session ID");
  }

  if (redirectUri !== logoutSession.redirectUri) {
    throw new ClientError("Invalid Redirect URI");
  }

  if (
    ![SessionStatus.CONFIRMED, SessionStatus.REJECTED, SessionStatus.SKIP].includes(
      logoutSession.status,
    )
  ) {
    return {
      redirect: createURL(configuration.redirect.logout, {
        host: configuration.services.authentication_service.host,
        port: configuration.services.authentication_service.port,
        query: { sessionId: logoutSession.id },
      }),
    };
  }

  if (logoutSession.sessionType === LogoutSessionType.BROWSER) {
    ctx.deleteCookie(BROWSER_SESSION_COOKIE_NAME);
  }

  ctx.deleteCookie(LOGOUT_SESSION_COOKIE_NAME);

  return {
    redirect: createURL(logoutSession.redirectUri, {
      query: { state: logoutSession.state },
    }),
  };
};
