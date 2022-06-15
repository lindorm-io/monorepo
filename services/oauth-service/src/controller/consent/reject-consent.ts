import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, SessionStatus } from "../../common";
import { createURL } from "@lindorm-io/core";
import { includes } from "lodash";

interface RequestData {
  id: string;
}

export const rejectConsentSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const rejectConsentController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { authorizationSessionCache },
    entity: { authorizationSession },
    logger,
  } = ctx;

  if (
    includes(
      [SessionStatus.CONFIRMED, SessionStatus.REJECTED, SessionStatus.SKIP],
      authorizationSession.consentStatus,
    )
  ) {
    throw new ClientError("Consent has already been set");
  }

  logger.debug("Updating authorization session");

  authorizationSession.consentStatus = SessionStatus.REJECTED;

  await authorizationSessionCache.update(authorizationSession);

  return {
    body: {
      redirectTo: createURL(authorizationSession.redirectUri, {
        query: {
          error: "request_rejected",
          error_description: "consent_rejected",
          state: authorizationSession.state,
        },
      }).toString(),
    },
  };
};
