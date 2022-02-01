import Joi from "joi";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { GetUserinfoRequestBody, GetUserinfoResponseBody, JOI_GUID } from "../../common";
import { getUserinfoResponseBody } from "../../handler";

export const getUserinfoSchema = Joi.object<GetUserinfoRequestBody>({
  id: JOI_GUID.required(),
  scope: Joi.string().required(),
});

export const getUserinfoController: Controller<Context<GetUserinfoRequestBody>> = async (
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
