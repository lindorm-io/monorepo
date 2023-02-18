import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import {
  RedirectSelectAccountRequestParams,
  RedirectSelectAccountResponse,
  SessionStatuses,
} from "@lindorm-io/common-types";
import {
  createAuthorizationVerifyUri,
  createSelectAccountPendingUri,
  createSelectAccountRejectedUri,
} from "../../util";

type RequestData = RedirectSelectAccountRequestParams;

type ResponseBody = RedirectSelectAccountResponse;

export const redirectSelectAccountSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const redirectSelectAccountController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { authorizationSession },
  } = ctx;

  switch (authorizationSession.status.selectAccount) {
    case SessionStatuses.CONFIRMED:
    case SessionStatuses.SKIP:
    case SessionStatuses.VERIFIED:
      return { body: { redirectTo: createAuthorizationVerifyUri(authorizationSession) } };

    case SessionStatuses.PENDING:
      return { body: { redirectTo: createSelectAccountPendingUri(authorizationSession) } };

    case SessionStatuses.REJECTED:
      return { body: { redirectTo: createSelectAccountRejectedUri(authorizationSession) } };

    default:
      throw new ClientError("Unexpected session status");
  }
};
