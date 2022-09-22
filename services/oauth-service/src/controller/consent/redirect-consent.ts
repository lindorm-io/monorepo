import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, ResponseWithRedirectBody, SessionStatus } from "../../common";
import { ServerKoaController } from "../../types";
import {
  createAuthorizationVerifyUri,
  createConsentPendingUri,
  createConsentRejectedUri,
} from "../../util";

interface RequestData {
  id: string;
}

export const redirectConsentSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const redirectConsentController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseWithRedirectBody> => {
  const {
    entity: { authorizationSession },
  } = ctx;

  switch (authorizationSession.status.consent) {
    case SessionStatus.CONFIRMED:
    case SessionStatus.SKIP:
      return { body: { redirectTo: createAuthorizationVerifyUri(authorizationSession) } };

    case SessionStatus.PENDING:
      return { body: { redirectTo: createConsentPendingUri(authorizationSession) } };

    case SessionStatus.REJECTED:
      return { body: { redirectTo: createConsentRejectedUri(authorizationSession) } };

    default:
      throw new ClientError("Unexpected session status");
  }
};
