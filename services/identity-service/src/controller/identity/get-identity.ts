import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { GetIdentityRequestParams, GetIdentityResponse } from "@lindorm-io/common-types";
import { ServerKoaController } from "../../types";
import { getIdentityResponse } from "../../handler";

type RequestData = GetIdentityRequestParams;

type ResponseBody = GetIdentityResponse;

export const getIdentitySchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .options({ abortEarly: false })
  .required();

export const getIdentityController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { identity },
  } = ctx;

  const body = await getIdentityResponse(ctx, identity);

  return { body };
};
