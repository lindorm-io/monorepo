import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { TokenRevokeRequestBody } from "@lindorm-io/common-types";
import { resolveTokenSession } from "../../handler";

type RequestData = TokenRevokeRequestBody;

export const revokeTokenSchema = Joi.object<RequestData>()
  .keys({
    token: Joi.string().min(128).required(),
    tokenTypeHint: Joi.string(),
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

  if (!opaqueToken) {
    throw new ClientError("Invalid token");
  }

  await opaqueTokenCache.destroy(opaqueToken);
};
