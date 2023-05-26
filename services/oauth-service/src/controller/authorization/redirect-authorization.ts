import {
  RedirectAuthorizationRequestParams,
  RedirectAuthorizationResponse,
  SessionStatus,
} from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { ServerKoaController } from "../../types";
import {
  createAuthorizationVerifyUri,
  createConsentPendingUri,
  createConsentRejectedUri,
  createLoginPendingUri,
  createLoginRejectedUri,
  createSelectAccountPendingUri,
  createSelectAccountRejectedUri,
} from "../../util";

type RequestData = RedirectAuthorizationRequestParams;

type ResponseBody = RedirectAuthorizationResponse;

export const redirectAuthorizationSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const redirectAuthorizationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { authorizationSession },
  } = ctx;

  switch (authorizationSession.status.selectAccount) {
    case SessionStatus.PENDING:
      return { body: { redirectTo: createSelectAccountPendingUri(authorizationSession) } };

    case SessionStatus.REJECTED:
      return { body: { redirectTo: createSelectAccountRejectedUri(authorizationSession) } };

    default:
      break;
  }

  switch (authorizationSession.status.login) {
    case SessionStatus.PENDING:
      return { body: { redirectTo: createLoginPendingUri(authorizationSession) } };

    case SessionStatus.REJECTED:
      return { body: { redirectTo: createLoginRejectedUri(authorizationSession) } };

    default:
      break;
  }

  switch (authorizationSession.status.consent) {
    case SessionStatus.PENDING:
      return { body: { redirectTo: createConsentPendingUri(authorizationSession) } };

    case SessionStatus.REJECTED:
      return { body: { redirectTo: createConsentRejectedUri(authorizationSession) } };

    default:
      break;
  }

  return { body: { redirectTo: createAuthorizationVerifyUri(authorizationSession) } };
};
