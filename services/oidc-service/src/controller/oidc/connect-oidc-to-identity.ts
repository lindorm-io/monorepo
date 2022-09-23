import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID } from "../../common";
import { ServerKoaController } from "../../types";
import { createOidcSession } from "../../handler";
import { getExpiryDate } from "@lindorm-io/core";

interface RequestData {
  callbackId: string;
  callbackUri: string;
  provider: string;
}

export const connectOidcToIdentitySchema = Joi.object<RequestData>().keys({
  callbackId: JOI_GUID.required(),
  callbackUri: Joi.string().uri().required(),
  provider: Joi.string().required(),
});

export const connectOidcToIdentityController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { callbackId, callbackUri, provider },
    token: {
      bearerToken: { subject: identityId },
    },
  } = ctx;

  const redirect = await createOidcSession(ctx, {
    callbackId,
    callbackUri,
    expires: getExpiryDate("15 minutes"),
    identityId,
    provider,
  });

  return { redirect };
};
