import { TokenRevokeRequestBody } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { resolveTokenSession } from "../../handler";
import { ServerKoaController } from "../../types";

type RequestData = TokenRevokeRequestBody;

export const revokeTokenSchema = Joi.object<RequestData>()
  .keys({
    token: Joi.string().min(128).required(),
  })
  .options({ abortEarly: false, allowUnknown: true })
  .required();

export const revokeTokenController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    redis: { opaqueTokenCache },
    data: { token },
  } = ctx;

  const opaqueToken = await resolveTokenSession(ctx, token);

  await opaqueTokenCache.destroy(opaqueToken);
};
