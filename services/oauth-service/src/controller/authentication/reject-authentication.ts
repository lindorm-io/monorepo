import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, ResponseWithRedirectBody, SessionStatus } from "../../common";
import { createURL } from "@lindorm-io/core";

interface RequestData {
  id: string;
}

export const rejectAuthenticationSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const rejectAuthenticationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseWithRedirectBody> => {
  const {
    cache: { authorizationSessionCache },
    entity: { authorizationSession },
    logger,
  } = ctx;

  if (
    [SessionStatus.CONFIRMED, SessionStatus.REJECTED, SessionStatus.SKIP].includes(
      authorizationSession.authenticationStatus,
    )
  ) {
    throw new ClientError("Authentication has already been set");
  }

  logger.debug("Updating authorization session");

  authorizationSession.authenticationStatus = SessionStatus.REJECTED;

  await authorizationSessionCache.update(authorizationSession);

  return {
    body: {
      redirectTo: createURL(authorizationSession.redirectUri, {
        query: {
          error: "request_rejected",
          error_description: "authentication_rejected",
          state: authorizationSession.state,
        },
      }).toString(),
    },
  };
};
