import {
  ConfirmSelectAccountRequestBody,
  ConfirmSelectAccountRequestParams,
  ConfirmSelectAccountResponse,
} from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { confirmOauthSelectAccount } from "../../../handler";
import { ServerKoaController } from "../../../types";

type RequestData = ConfirmSelectAccountRequestParams & ConfirmSelectAccountRequestBody;

type ResponseBody = ConfirmSelectAccountResponse;

export const confirmSelectAccountSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    selectExisting: Joi.string(),
    selectNew: Joi.boolean(),
  })
  .required();

export const confirmSelectAccountController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { id, selectExisting, selectNew },
  } = ctx;

  const { redirectTo } = await confirmOauthSelectAccount(ctx, id, { selectExisting, selectNew });

  return { body: { redirectTo } };
};
