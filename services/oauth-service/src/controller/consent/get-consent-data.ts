import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { GetConsentInfoResponseBody, JOI_GUID } from "../../common";
import { ServerKoaController } from "../../types";
import { getExpires } from "@lindorm-io/core";
import { isConsentRequired } from "../../util";

interface RequestData {
  id: string;
}

export const getConsentDataSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const getConsentDataController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<GetConsentInfoResponseBody> => {
  const {
    entity: { authorizationSession, client },
    repository: { browserSessionRepository, consentSessionRepository },
  } = ctx;

  const browserSession = authorizationSession.identifiers.browserSessionId
    ? await browserSessionRepository.find({ id: authorizationSession.identifiers.browserSessionId })
    : undefined;

  let consentSession;

  try {
    consentSession = await consentSessionRepository.find({
      clientId: authorizationSession.clientId,
      identityId: authorizationSession.confirmedLogin.identityId,
    });
  } catch (err) {
    if (!(err instanceof EntityNotFoundError)) throw err;
  }

  const consentRequired = isConsentRequired(authorizationSession, browserSession, consentSession);

  const { expires, expiresIn } = getExpires(authorizationSession.expires);

  return {
    body: {
      consentRequired,
      consentStatus: authorizationSession.status.consent,
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
      consentSession: {
        audiences: consentSession?.audiences || [],
        scopes: consentSession?.scopes || [],
      },
      requested: {
        audiences: authorizationSession.requestedConsent.audiences,
        scopes: authorizationSession.requestedConsent.scopes,
      },
    },
  };
};
