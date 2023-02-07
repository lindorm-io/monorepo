import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import { ConfirmLogoutRequestParams, ConfirmLogoutResponse } from "@lindorm-io/common-types";
import { ClientScopes } from "../../../common";

type RequestData = ConfirmLogoutRequestParams;

export const confirmLogoutSessionSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const confirmLogoutSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    axios: { oauthClient },
    data: { id },
  } = ctx;

  const { data } = await oauthClient.post<ConfirmLogoutResponse>(
    "/internal/sessions/logout/:id/confirm",
    {
      params: { id },
      middleware: [clientCredentialsMiddleware(oauthClient, [ClientScopes.OAUTH_LOGOUT_WRITE])],
    },
  );

  return { body: data };
};
