import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import {
  RedirectConsentRequestParams,
  RedirectConsentResponse,
  SessionStatuses,
} from "@lindorm-io/common-types";
import {
  createAuthorizationVerifyUri,
  createConsentPendingUri,
  createConsentRejectedUri,
} from "../../util";

type RequestData = RedirectConsentRequestParams;

type ResponseBody = RedirectConsentResponse;

export const redirectConsentSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const redirectConsentController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { authorizationSession },
  } = ctx;

  switch (authorizationSession.status.consent) {
    case SessionStatuses.CONFIRMED:
    case SessionStatuses.SKIP:
    case SessionStatuses.VERIFIED:
      return { body: { redirectTo: createAuthorizationVerifyUri(authorizationSession) } };

    case SessionStatuses.PENDING:
      return { body: { redirectTo: createConsentPendingUri(authorizationSession) } };

    case SessionStatuses.REJECTED:
      return { body: { redirectTo: createConsentRejectedUri(authorizationSession) } };

    default:
      throw new ClientError("Unexpected session status");
  }
};
