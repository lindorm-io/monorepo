import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { createAuthorizationVerifyRedirectUri } from "../../util";
import { flatten, includes, uniq } from "lodash";
import {
  ConfirmConsentRequestBody,
  JOI_GUID,
  ResponseWithRedirectBody,
  SessionStatus,
} from "../../common";

interface RequestData extends ConfirmConsentRequestBody {
  id: string;
}

export const confirmConsentSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
  audiences: Joi.array().items(JOI_GUID).required(),
  scopes: Joi.array().items(Joi.string()).required(),
});

export const confirmConsentController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseWithRedirectBody> => {
  const {
    cache: { authorizationSessionCache },
    data: { audiences, scopes },
    entity: { authorizationSession, browserSession, consentSession },
    logger,
    repository: { consentSessionRepository },
  } = ctx;

  if (
    includes(
      [SessionStatus.CONFIRMED, SessionStatus.REJECTED, SessionStatus.SKIP],
      authorizationSession.consentStatus,
    )
  ) {
    throw new ClientError("Consent has already been set");
  }

  logger.debug("Updating consent session");

  consentSession.audiences = uniq(flatten([consentSession.audiences, audiences])).sort();
  consentSession.scopes = uniq(flatten([consentSession.scopes, scopes])).sort();
  consentSession.sessions = uniq(flatten([consentSession.sessions, browserSession.id])).sort();

  await consentSessionRepository.update(consentSession);

  logger.debug("Updating authorization session");

  authorizationSession.consentStatus = SessionStatus.CONFIRMED;

  await authorizationSessionCache.update(authorizationSession);

  return {
    body: { redirectTo: createAuthorizationVerifyRedirectUri(authorizationSession) },
  };
};
