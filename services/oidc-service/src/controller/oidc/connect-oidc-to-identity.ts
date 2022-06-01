import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { createOidcSession } from "../../handler";
import { getExpiryDate } from "@lindorm-io/core";

interface RequestData {
  callbackUri: string;
  provider: string;
}

export const connectOidcToIdentitySchema = Joi.object<RequestData>().keys({
  callbackUri: Joi.string().uri().required(),
  provider: Joi.string().required(),
});

export const connectOidcToIdentityController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { callbackUri, provider },
    token: {
      bearerToken: { subject: identityId },
    },
  } = ctx;

  const redirect = await createOidcSession(ctx, {
    callbackUri,
    expires: getExpiryDate("15 minutes"),
    identityId,
    provider,
  });

  return { redirect };
};
