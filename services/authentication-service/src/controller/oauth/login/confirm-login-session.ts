import { ConfirmLoginResponse } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { confirmOauthLogin } from "../../../handler";
import { ServerKoaController } from "../../../types";

type RequestData = {
  id: string;
  authenticationConfirmationToken: string;
};

type ResponseBody = ConfirmLoginResponse;

export const confirmLoginSessionSchema = Joi.object<RequestData>({
  id: Joi.string().guid().required(),
  authenticationConfirmationToken: Joi.string().min(128).required(),
});

export const confirmLoginSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { authenticationConfirmationToken },
  } = ctx;

  const { redirectTo } = await confirmOauthLogin(ctx, authenticationConfirmationToken);

  return { body: { redirectTo } };
};
