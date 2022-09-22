import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, ResponseWithRedirectBody, SessionStatus } from "../../common";
import { ServerKoaController } from "../../types";
import { createLogoutPendingUri, createLogoutRejectedUri, createLogoutVerifyUri } from "../../util";

interface RequestData {
  id: string;
}

export const redirectLogoutSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const redirectLogoutController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseWithRedirectBody> => {
  const {
    entity: { logoutSession },
  } = ctx;

  switch (logoutSession.status) {
    case SessionStatus.CONFIRMED:
    case SessionStatus.SKIP:
      return { body: { redirectTo: createLogoutVerifyUri(logoutSession) } };

    case SessionStatus.PENDING:
      return { body: { redirectTo: createLogoutPendingUri(logoutSession) } };

    case SessionStatus.REJECTED:
      return { body: { redirectTo: createLogoutRejectedUri(logoutSession) } };

    default:
      throw new ClientError("Unexpected session status");
  }
};
