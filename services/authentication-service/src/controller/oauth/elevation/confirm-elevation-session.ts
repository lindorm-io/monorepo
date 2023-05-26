import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { JOI_JWT } from "../../../common";
import { confirmOauthElevation } from "../../../handler";
import { ServerKoaController } from "../../../types";

interface RequestData {
  id: string;
  authenticationConfirmationToken: string;
}

export const confirmElevationSessionSchema = Joi.object<RequestData>({
  id: Joi.string().guid().required(),
  authenticationConfirmationToken: JOI_JWT.required(),
});

export const confirmElevationSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    token: { authenticationConfirmationToken },
  } = ctx;

  const { redirectTo } = await confirmOauthElevation(ctx, authenticationConfirmationToken);

  if (redirectTo) {
    return { body: { redirectTo } };
  }
};
