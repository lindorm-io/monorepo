import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_JWT } from "../../../common";
import { ServerKoaController } from "../../../types";
import { confirmOauthElevation } from "../../../handler";

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
