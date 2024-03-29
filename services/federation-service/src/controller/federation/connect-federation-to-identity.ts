import { ConnectFederationToIdentityRequestQuery } from "@lindorm-io/common-types";
import { expiryDate } from "@lindorm-io/expiry";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { createFederationSession } from "../../handler";
import { ServerKoaController } from "../../types";

type RequestData = ConnectFederationToIdentityRequestQuery;

export const connectFederationToIdentitySchema = Joi.object<RequestData>().keys({
  callbackId: Joi.string().guid().required(),
  callbackUri: Joi.string().uri().required(),
  provider: Joi.string().required(),
});

export const connectFederationToIdentityController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { callbackId, callbackUri, provider },
    token: {
      bearerToken: { subject: identityId },
    },
  } = ctx;

  const redirect = await createFederationSession(ctx, {
    callbackId,
    callbackUri,
    expires: expiryDate("15 minutes"),
    identityId,
    provider,
  });

  return { redirect };
};
