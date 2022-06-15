import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { GetConsentInfoResponseBody, JOI_GUID } from "../../common";
import { isConsentRequired } from "../../util";
import { getExpires } from "@lindorm-io/core";

interface RequestData {
  id: string;
}

export const getConsentInfoSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const getConsentInfoController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<GetConsentInfoResponseBody> => {
  const {
    cache: { authorizationSessionCache },
    entity: { authorizationSession, browserSession, client },
    logger,
    repository: { consentSessionRepository },
  } = ctx;

  logger.debug("Finding consent session");

  const consentSession = await consentSessionRepository.findOrCreate({
    clientId: client.id,
    identityId: browserSession.identityId,
  });

  if (authorizationSession.consentSessionId !== consentSession.id) {
    authorizationSession.consentSessionId = consentSession.id;

    await authorizationSessionCache.update(authorizationSession);
  }

  const consentRequired = isConsentRequired(authorizationSession, browserSession, consentSession);

  const { expires, expiresIn } = getExpires(authorizationSession.expires);

  return {
    body: {
      authorizationSession: {
        id: authorizationSession.id,
        displayMode: authorizationSession.displayMode,
        expiresIn,
        expiresAt: expires.toISOString(),
        originalUri: authorizationSession.originalUri,
        promptModes: authorizationSession.promptModes,
        uiLocales: authorizationSession.uiLocales,
      },
      client: {
        description: client.description,
        logoUri: client.logoUri,
        name: client.name,
        requiredScopes: client.requiredScopes,
        scopeDescriptions: client.scopeDescriptions,
        type: client.type,
      },
      consentRequired,
      consentSession: {
        audiences: consentSession.audiences,
        scopes: consentSession.scopes,
      },
      consentStatus: authorizationSession.consentStatus,
      requested: {
        audiences: authorizationSession.audiences,
        scopes: authorizationSession.scopes,
      },
    },
  };
};
