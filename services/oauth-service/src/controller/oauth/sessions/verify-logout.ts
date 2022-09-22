import Joi from "joi";
import { BROWSER_SESSION_COOKIE_NAME } from "../../../constant";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, SessionStatus } from "../../../common";
import { LogoutSessionType } from "../../../enum";
import { ServerKoaController } from "../../../types";
import { handleBrowserSessionLogout, handleRefreshSessionLogout } from "../../../handler";
import {
  createLogoutPendingUri,
  createLogoutRedirectUri,
  createLogoutRejectedUri,
} from "../../../util";

interface RequestData {
  redirectUri: string;
  sessionId: string;
}

export const verifyLogoutSchema = Joi.object<RequestData>()
  .keys({
    redirectUri: Joi.string().uri().required(),
    sessionId: JOI_GUID.required(),
  })
  .required();

export const verifyLogoutController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { redirectUri },
    entity: { logoutSession },
  } = ctx;

  if (redirectUri !== logoutSession.redirectUri) {
    throw new ClientError("Invalid Redirect URI");
  }

  switch (logoutSession.status) {
    case SessionStatus.CONFIRMED:
    case SessionStatus.SKIP:
      break;

    case SessionStatus.PENDING:
      return { redirect: createLogoutPendingUri(logoutSession) };

    case SessionStatus.REJECTED:
      return { redirect: createLogoutRejectedUri(logoutSession) };

    default:
      throw new ClientError("Unexpected session status");
  }

  switch (logoutSession.sessionType) {
    case LogoutSessionType.BROWSER:
      await handleBrowserSessionLogout(ctx, logoutSession);
      ctx.cookies.set(BROWSER_SESSION_COOKIE_NAME);
      break;

    case LogoutSessionType.REFRESH:
      await handleRefreshSessionLogout(ctx, logoutSession);
      break;

    default:
      throw new ServerError("Unexpected sessionType");
  }

  return { redirect: createLogoutRedirectUri(logoutSession) };
};
