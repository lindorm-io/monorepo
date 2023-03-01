import Joi from "joi";
import { ConfirmLoginResponse } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_JWT } from "../../../common";
import { ServerKoaController } from "../../../types";
import { confirmOauthLogin } from "../../../handler";

type RequestData = {
  id: string;
  authenticationConfirmationToken: string;
};

type ResponseBody = ConfirmLoginResponse;

export const confirmLoginSessionSchema = Joi.object<RequestData>({
  id: Joi.string().guid().required(),
  authenticationConfirmationToken: JOI_JWT.required(),
});

export const confirmLoginSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    token: { authenticationConfirmationToken },
  } = ctx;

  const { redirectTo } = await confirmOauthLogin(ctx, authenticationConfirmationToken);

  return { body: { redirectTo } };
};
