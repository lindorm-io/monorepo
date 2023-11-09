import { SessionStatus } from "@lindorm-io/common-enums";
import { VerifyLogoutRequestQuery } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { handleBrowserSessionLogout, handleClientSessionLogout } from "../../handler";
import { ServerKoaController } from "../../types";
import {
  createLogoutPendingUri,
  createLogoutRedirectUri,
  createLogoutRejectedUri,
} from "../../util";

type RequestData = VerifyLogoutRequestQuery;

export const verifyLogoutSchema = Joi.object<RequestData>()
  .keys({
    postLogoutRedirectUri: Joi.string().uri().required(),
    session: Joi.string().guid().required(),
  })
  .required();

export const verifyLogoutController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { postLogoutRedirectUri },
    entity: { client, logoutSession },
  } = ctx;

  if (postLogoutRedirectUri !== logoutSession.postLogoutRedirectUri) {
    throw new ClientError("Invalid Redirect URI");
  }

  switch (logoutSession.status) {
    case SessionStatus.CONFIRMED:
      break;

    case SessionStatus.PENDING:
      return { redirect: createLogoutPendingUri(logoutSession) };

    case SessionStatus.REJECTED:
      return { redirect: createLogoutRejectedUri(logoutSession) };

    default:
      throw new ClientError("Unexpected session status");
  }

  if (logoutSession.confirmedLogout.browserSessionId) {
    await handleBrowserSessionLogout(ctx, logoutSession);
  }

  if (logoutSession.confirmedLogout.clientSessionId) {
    await handleClientSessionLogout(ctx, logoutSession, client);
  }

  return { redirect: createLogoutRedirectUri(logoutSession) };
};
