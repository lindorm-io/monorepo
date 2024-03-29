import {
  ConfirmConsentRequestBody,
  ConfirmConsentRequestParams,
  ConfirmConsentResponse,
} from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { difference } from "lodash";
import { ServerKoaController } from "../../types";
import { assertSessionPending, createAuthorizationVerifyUri } from "../../util";

type RequestData = ConfirmConsentRequestParams & ConfirmConsentRequestBody;

type ResponseBody = ConfirmConsentResponse;

export const confirmAuthorizationConsentSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    audiences: Joi.array().items(Joi.string().guid()).required(),
    scopes: Joi.array().items(Joi.string()).required(),
  })
  .required();

export const confirmAuthorizationConsentController: ServerKoaController<RequestData> = async (
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

  authorizationSession.confirmConsent({
    audiences,
    scopes,
  });

  await authorizationSessionCache.update(authorizationSession);

  return { body: { redirectTo: createAuthorizationVerifyUri(authorizationSession) } };
};
