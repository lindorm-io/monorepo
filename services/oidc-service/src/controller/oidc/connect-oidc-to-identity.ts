import Joi from "joi";
import { ConnectOidcToIdentityRequestQuery } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { createOidcSession } from "../../handler";
import { expiryDate } from "@lindorm-io/expiry";

type RequestData = ConnectOidcToIdentityRequestQuery;

export const connectOidcToIdentitySchema = Joi.object<RequestData>().keys({
  callbackId: Joi.string().guid().required(),
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
    expires: expiryDate("15 minutes"),
    identityId,
    provider,
  });

  return { redirect };
};
