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
    redis: { authorizationRequestCache },
    data: { audiences, scopes },
    entity: { authorizationRequest, client },
    logger,
  } = ctx;

  assertSessionPending(authorizationRequest.status.consent);

  const wrongAudiences = difference(authorizationRequest.requestedConsent.audiences, audiences);

  if (wrongAudiences.length) {
    throw new ClientError("Invalid Audiences", {
      description: "Unexpected audiences added",
      data: {
        expect: authorizationRequest.requestedConsent.audiences,
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

  const wrongScopes = difference(authorizationRequest.requestedConsent.scopes, scopes);

  if (wrongScopes.length) {
    throw new ClientError("Invalid Scopes", {
      description: "Unexpected scopes added",
      data: {
        expect: authorizationRequest.requestedConsent.scopes,
        actual: scopes,
        wrong: wrongScopes,
      },
    });
  }

  logger.debug("Updating authorization session");

  authorizationRequest.confirmConsent({
    audiences,
    scopes,
  });

  await authorizationRequestCache.update(authorizationRequest);

  return { body: { redirectTo: createAuthorizationVerifyUri(authorizationRequest) } };
};
