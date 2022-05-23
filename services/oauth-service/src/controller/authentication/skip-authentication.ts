import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, ResponseWithRedirectBody, SessionStatus } from "../../common";
import { includes } from "lodash";
import { createAuthorizationVerifyRedirectUri, isAuthenticationRequired } from "../../util";

interface RequestData {
  id: string;
}

export const skipAuthenticationSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
});

export const skipAuthenticationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseWithRedirectBody> => {
  const {
    cache: { authorizationSessionCache },
    entity: { authorizationSession, browserSession },
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

  if (isAuthenticationRequired(authorizationSession, browserSession)) {
    throw new ClientError("Invalid Request", {
      description: "Unable to skip authentication that cannot be skipped",
    });
  }

  logger.debug("Updating authorization session");

  authorizationSession.authenticationStatus = SessionStatus.SKIP;

  await authorizationSessionCache.update(authorizationSession);

  return { body: { redirectTo: createAuthorizationVerifyRedirectUri(authorizationSession) } };
};
