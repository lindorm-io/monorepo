import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { createOidcSession } from "../../handler";
import { findOidcConfiguration } from "../../util";
import {
  InitialiseOidcSessionRequestBody,
  InitialiseOidcSessionResponse,
} from "@lindorm-io/common-types";

type RequestData = InitialiseOidcSessionRequestBody;

type ResponseBody = InitialiseOidcSessionResponse;

export const initialiseOidcSessionSchema = Joi.object<RequestData>()
  .keys({
    callbackId: Joi.string().guid().required(),
    callbackUri: Joi.string().uri().required(),
    expires: Joi.string().required(),
    identityId: Joi.string().guid().optional(),
    loginHint: Joi.string().optional(),
    provider: Joi.string().required(),
  })
  .required();

export const initialiseOidcSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { callbackId, callbackUri, expires, identityId, loginHint, provider },
  } = ctx;

  findOidcConfiguration(provider);

  const url = await createOidcSession(ctx, {
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
