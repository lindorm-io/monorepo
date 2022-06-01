import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { createOidcSession } from "../../handler";
import {
  InitialiseOidcSessionRequestData,
  InitialiseOidcSessionResponseBody,
  JOI_GUID,
} from "../../common";

export const initialiseOidcSessionSchema = Joi.object<InitialiseOidcSessionRequestData>()
  .keys({
    callbackUri: Joi.string().uri().required(),
    expires: Joi.string().required(),
    identityId: JOI_GUID.optional(),
    loginHint: Joi.string().optional(),
    provider: Joi.string().required(),
  })
  .required();

export const initialiseOidcSessionController: ServerKoaController<
  InitialiseOidcSessionRequestData
> = async (ctx): ControllerResponse<InitialiseOidcSessionResponseBody> => {
  const {
    data: { callbackUri, expires, identityId, loginHint, provider },
  } = ctx;

  const url = await createOidcSession(ctx, {
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
