import {
  InitialiseFederationSessionRequestBody,
  InitialiseFederationSessionResponse,
} from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { createFederationSession } from "../../handler";
import { ServerKoaController } from "../../types";
import { findFederationConfiguration } from "../../util";

type RequestData = InitialiseFederationSessionRequestBody;

type ResponseBody = InitialiseFederationSessionResponse;

export const initialiseFederationSessionSchema = Joi.object<RequestData>()
  .keys({
    callbackId: Joi.string().guid().required(),
    callbackUri: Joi.string().uri().required(),
    expires: Joi.string().required(),
    identityId: Joi.string().guid().optional(),
    loginHint: Joi.string().optional(),
    provider: Joi.string().required(),
  })
  .required();

export const initialiseFederationSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { callbackId, callbackUri, expires, identityId, loginHint, provider },
  } = ctx;

  findFederationConfiguration(provider);

  const url = await createFederationSession(ctx, {
    callbackId,
    callbackUri,
    expires: new Date(expires),
    identityId,
    loginHint,
    provider,
  });

  return {
    body: { redirectTo: url.toString() },
  };
};
