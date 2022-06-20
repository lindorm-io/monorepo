import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, ResponseWithRedirectBody, SessionStatus } from "../../common";
import { ServerKoaController } from "../../types";
import { createAuthorizationVerifyRedirectUri, isConsentRequired } from "../../util";
import { flatten, uniq } from "lodash";

interface RequestData {
  id: string;
}

export const skipConsentSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const skipConsentController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseWithRedirectBody> => {
  const {
    cache: { authorizationSessionCache },
    entity: { authorizationSession, browserSession, consentSession },
    logger,
    repository: { consentSessionRepository },
  } = ctx;

  if (
    [SessionStatus.CONFIRMED, SessionStatus.REJECTED, SessionStatus.SKIP].includes(
      authorizationSession.consentStatus,
    )
  ) {
    throw new ClientError("Consent has already been set");
  }

  if (isConsentRequired(authorizationSession, browserSession, consentSession)) {
    throw new ClientError("Invalid Request", {
      description: "Unable to skip consent that cannot be skipped",
    });
  }

  logger.debug("Updating consent session");

  consentSession.sessions = uniq(flatten([consentSession.sessions, browserSession.id])).sort();

  await consentSessionRepository.update(consentSession);

  logger.debug("Updating authorization session");

  authorizationSession.consentStatus = SessionStatus.SKIP;

  await authorizationSessionCache.update(authorizationSession);

  return { body: { redirectTo: createAuthorizationVerifyRedirectUri(authorizationSession) } };
};
