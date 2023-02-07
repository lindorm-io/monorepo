import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import {
  RedirectLoginRequestParams,
  RedirectLoginResponse,
  SessionStatuses,
} from "@lindorm-io/common-types";
import {
  createAuthorizationVerifyUri,
  createLoginPendingUri,
  createLoginRejectedUri,
} from "../../util";

type RequestData = RedirectLoginRequestParams;

type ResponseBody = RedirectLoginResponse;

export const redirectLoginSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const redirectLoginController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { authorizationSession },
  } = ctx;

  switch (authorizationSession.status.login) {
    case SessionStatuses.CONFIRMED:
    case SessionStatuses.SKIP:
    case SessionStatuses.VERIFIED:
      return { body: { redirectTo: createAuthorizationVerifyUri(authorizationSession) } };

    case SessionStatuses.PENDING:
      return { body: { redirectTo: createLoginPendingUri(authorizationSession) } };

    case SessionStatuses.REJECTED:
      return { body: { redirectTo: createLoginRejectedUri(authorizationSession) } };

    default:
      throw new ClientError("Unexpected session status");
  }
};
