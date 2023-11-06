import {
  ConfirmLogoutRequestBody,
  ConfirmLogoutRequestParams,
  ConfirmLogoutResponse,
} from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { confirmOauthLogout } from "../../../handler";
import { ServerKoaController } from "../../../types";

type RequestData = ConfirmLogoutRequestParams & ConfirmLogoutRequestBody;

type ResponseBody = ConfirmLogoutResponse;

export const confirmLogoutSessionSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    browserSessionId: Joi.string().guid(),
    clientSessionId: Joi.string().guid(),
  })
  .required();

export const confirmLogoutSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { id, browserSessionId, clientSessionId },
  } = ctx;

  const { redirectTo } = await confirmOauthLogout(ctx, id, {
    browserSessionId,
    clientSessionId,
  });

  return { body: { redirectTo } };
};
