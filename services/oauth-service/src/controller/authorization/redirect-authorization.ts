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
    entity: { authorizationRequest },
  } = ctx;

  switch (authorizationRequest.status.selectAccount) {
    case SessionStatus.PENDING:
      return { body: { redirectTo: createSelectAccountPendingUri(authorizationRequest) } };

    case SessionStatus.REJECTED:
      return { body: { redirectTo: createSelectAccountRejectedUri(authorizationRequest) } };

    default:
      break;
  }

  switch (authorizationRequest.status.login) {
    case SessionStatus.PENDING:
      return { body: { redirectTo: createLoginPendingUri(authorizationRequest) } };

    case SessionStatus.REJECTED:
      return { body: { redirectTo: createLoginRejectedUri(authorizationRequest) } };

    default:
      break;
  }

  switch (authorizationRequest.status.consent) {
    case SessionStatus.PENDING:
      return { body: { redirectTo: createConsentPendingUri(authorizationRequest) } };

    case SessionStatus.REJECTED:
      return { body: { redirectTo: createConsentRejectedUri(authorizationRequest) } };

    default:
      break;
  }

  return { body: { redirectTo: createAuthorizationVerifyUri(authorizationRequest) } };
};
