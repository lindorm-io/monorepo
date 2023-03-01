import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { confirmOauthLogout } from "../../../handler";
import {
  ConfirmLogoutRequestBody,
  ConfirmLogoutRequestParams,
  ConfirmLogoutResponse,
} from "@lindorm-io/common-types";

type RequestData = ConfirmLogoutRequestParams & ConfirmLogoutRequestBody;

type ResponseBody = ConfirmLogoutResponse;

export const confirmLogoutSessionSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    accessSessionId: Joi.string().guid(),
    browserSessionId: Joi.string().guid(),
    refreshSessionId: Joi.string().guid(),
  })
  .required();

export const confirmLogoutSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { id, accessSessionId, browserSessionId, refreshSessionId },
  } = ctx;

  const { redirectTo } = await confirmOauthLogout(ctx, id, {
    accessSessionId,
    browserSessionId,
    refreshSessionId,
  });

  return { body: { redirectTo } };
};
