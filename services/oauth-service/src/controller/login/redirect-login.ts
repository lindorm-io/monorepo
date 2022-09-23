import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, ResponseWithRedirectBody, SessionStatus } from "../../common";
import { ServerKoaController } from "../../types";
import {
  createAuthorizationVerifyUri,
  createLoginPendingUri,
  createLoginRejectedUri,
} from "../../util";

interface RequestData {
  id: string;
}

export const redirectLoginSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const redirectLoginController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseWithRedirectBody> => {
  const {
    entity: { authorizationSession },
  } = ctx;

  switch (authorizationSession.status.login) {
    case SessionStatus.CONFIRMED:
    case SessionStatus.SKIP:
    case SessionStatus.VERIFIED:
      return { body: { redirectTo: createAuthorizationVerifyUri(authorizationSession) } };

    case SessionStatus.PENDING:
      return { body: { redirectTo: createLoginPendingUri(authorizationSession) } };

    case SessionStatus.REJECTED:
      return { body: { redirectTo: createLoginRejectedUri(authorizationSession) } };

    default:
      throw new ClientError("Unexpected session status");
  }
};
