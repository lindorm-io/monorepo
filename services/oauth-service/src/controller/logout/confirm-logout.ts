import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, ResponseWithRedirectBody, SessionStatus } from "../../common";
import { LogoutSessionType } from "../../enum";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { createLogoutVerifyRedirectUri } from "../../util";
import { handleBrowserSessionLogout, handleRefreshSessionLogout } from "../../handler";
import { includes } from "lodash";

interface RequestData {
  id: string;
}

export const confirmLogoutSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const confirmLogoutController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseWithRedirectBody> => {
  const {
    cache: { logoutSessionCache },
    entity: { logoutSession },
    logger,
  } = ctx;

  if (includes([SessionStatus.CONFIRMED, SessionStatus.REJECTED], logoutSession.status)) {
    throw new ClientError("Logout has already been set");
  }

  switch (logoutSession.sessionType) {
    case LogoutSessionType.BROWSER:
      await handleBrowserSessionLogout(ctx, logoutSession);
      break;

    case LogoutSessionType.REFRESH:
      await handleRefreshSessionLogout(ctx, logoutSession);
      break;

    default:
      throw new ServerError("Unexpected sessionType");
  }

  logger.debug("Updating logout session");

  logoutSession.status = SessionStatus.CONFIRMED;

  await logoutSessionCache.update(logoutSession);

  return { body: { redirectTo: createLogoutVerifyRedirectUri(logoutSession) } };
};
