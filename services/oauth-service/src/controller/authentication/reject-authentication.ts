import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, ResponseWithRedirectBody, SessionStatus } from "../../common";
import { createURL } from "@lindorm-io/core";
import { includes } from "lodash";

interface RequestData {
  id: string;
}

export const rejectAuthenticationSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
});

export const rejectAuthenticationController: Controller<Context<RequestData>> = async (
  ctx,
): ControllerResponse<ResponseWithRedirectBody> => {
  const {
    cache: { authorizationSessionCache },
    entity: { authorizationSession },
    logger,
  } = ctx;

  if (
    includes(
      [SessionStatus.CONFIRMED, SessionStatus.REJECTED, SessionStatus.SKIP],
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
