import Joi from "joi";
import { BROWSER_SESSION_COOKIE_NAME, LOGOUT_SESSION_COOKIE_NAME } from "../../constant";
import { ClientError } from "@lindorm-io/errors";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, SessionStatus } from "../../common";
import { LogoutSessionType } from "../../enum";
import { configuration } from "../../configuration";
import { createURL } from "@lindorm-io/core";
import { includes } from "lodash";

interface RequestData {
  redirectUri: string;
  sessionId: string;
}

export const oauthVerifyLogoutSchema = Joi.object<RequestData>({
  redirectUri: Joi.string().uri().required(),
  sessionId: JOI_GUID,
});

export const oauthVerifyLogoutController: Controller<Context<RequestData>> = async (
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
    !includes(
      [SessionStatus.CONFIRMED, SessionStatus.REJECTED, SessionStatus.SKIP],
      logoutSession.status,
    )
  ) {
    return {
      redirect: createURL(configuration.redirect.logout, {
        baseUrl: configuration.services.authentication_service,
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
