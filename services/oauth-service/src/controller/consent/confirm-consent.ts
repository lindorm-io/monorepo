import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { assertSessionPending, createAuthorizationVerifyUri } from "../../util";
import { difference } from "lodash";
import {
  ConfirmConsentRequestBody,
  ConfirmConsentRequestParams,
  ConfirmConsentResponse,
  SessionStatus,
} from "@lindorm-io/common-types";

type RequestData = ConfirmConsentRequestParams & ConfirmConsentRequestBody;

type ResponseBody = ConfirmConsentResponse;

export const confirmConsentSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    audiences: Joi.array().items(Joi.string().guid()).required(),
    scopes: Joi.array().items(Joi.string()).required(),
  })
  .required();

export const confirmConsentController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    redis: { authorizationSessionCache },
    data: { audiences, scopes },
    entity: { authorizationSession, client },
    logger,
  } = ctx;

  assertSessionPending(authorizationSession.status.consent);

  const wrongAudiences = difference(authorizationSession.requestedConsent.audiences, audiences);

  if (wrongAudiences.length) {
    throw new ClientError("Invalid Audiences", {
      description: "Unexpected audiences added",
      data: {
        expect: authorizationSession.requestedConsent.audiences,
        actual: audiences,
        wrong: wrongAudiences,
      },
    });
  }

  const missingScopes = difference(client.requiredScopes, scopes);

  if (missingScopes.length) {
    throw new ClientError("Invalid Scopes", {
      description: "Required scopes missing",
      data: {
        expect: client.requiredScopes,
        actual: scopes,
        missing: missingScopes,
      },
    });
  }

  const wrongScopes = difference(authorizationSession.requestedConsent.scopes, scopes);

  if (wrongScopes.length) {
    throw new ClientError("Invalid Scopes", {
      description: "Unexpected scopes added",
      data: {
        expect: authorizationSession.requestedConsent.scopes,
        actual: scopes,
        wrong: wrongScopes,
      },
    });
  }

  logger.debug("Updating authorization session");

  authorizationSession.confirmedConsent.audiences = audiences;
  authorizationSession.confirmedConsent.scopes = scopes;

  authorizationSession.status.consent = SessionStatus.CONFIRMED;

  await authorizationSessionCache.update(authorizationSession);

  return { body: { redirectTo: createAuthorizationVerifyUri(authorizationSession) } };
};
