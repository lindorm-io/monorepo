import { ConfirmLoginResponse } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { confirmOauthLogin, resolveAuthenticationConfirmationToken } from "../../../handler";
import { ServerKoaController } from "../../../types";

type RequestData = {
  id: string;
  token: string;
};

type ResponseBody = ConfirmLoginResponse;

export const confirmLoginSessionSchema = Joi.object<RequestData>({
  id: Joi.string().guid().required(),
  token: Joi.string().min(128).required(),
});

export const confirmLoginSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { token },
  } = ctx;

  const authenticationConfirmationToken = await resolveAuthenticationConfirmationToken(ctx, token);

  const { redirectTo } = await confirmOauthLogin(ctx, authenticationConfirmationToken);

  return { body: { redirectTo } };
};
