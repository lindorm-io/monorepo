import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { EnsureIdentityRequestParams, GetIdentityResponse } from "@lindorm-io/common-types";
import { Identity } from "../../entity";
import { ServerKoaController } from "../../types";
import { getIdentityResponse } from "../../handler";

type RequestData = EnsureIdentityRequestParams;

type ResponseData = GetIdentityResponse;

export const ensureIdentitySchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .options({ abortEarly: false })
  .required();

export const ensureIdentityController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseData> => {
  const {
    data: { id },
    repository: { identityRepository },
  } = ctx;

  let identity = await identityRepository.tryFind({ id });

  if (!identity) {
    identity = await identityRepository.create(new Identity({ id }));
  }

  const body = await getIdentityResponse(ctx, identity);

  return { body };
};
