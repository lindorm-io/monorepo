import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { confirmOauthElevation, resolveAuthenticationConfirmationToken } from "../../../handler";
import { ServerKoaController } from "../../../types";

interface RequestData {
  id: string;
  token: string;
}

export const confirmElevationSessionSchema = Joi.object<RequestData>({
  id: Joi.string().guid().required(),
  token: Joi.string().required(),
});

export const confirmElevationSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { token },
  } = ctx;

  const authenticationConfirmationToken = await resolveAuthenticationConfirmationToken(ctx, token);

  const { redirectTo } = await confirmOauthElevation(ctx, authenticationConfirmationToken);

  if (redirectTo) {
    return { body: { redirectTo } };
  }
};
