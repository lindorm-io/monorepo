import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { GetUserinfoRequestBody, GetUserinfoResponseBody, JOI_GUID } from "../../common";
import { ServerKoaController } from "../../types";
import { getUserinfoResponseBody } from "../../handler";

export const getUserinfoSchema = Joi.object<GetUserinfoRequestBody>()
  .keys({
    id: JOI_GUID.required(),
    scope: Joi.string().required(),
  })
  .required();

export const getUserinfoController: ServerKoaController<GetUserinfoRequestBody> = async (
  ctx,
): ControllerResponse<GetUserinfoResponseBody> => {
  const {
    data: { scope },
    entity: { identity },
  } = ctx;

  const scopes = scope.split(" ");
  const body = await getUserinfoResponseBody(ctx, identity, scopes);

  return { body };
};
