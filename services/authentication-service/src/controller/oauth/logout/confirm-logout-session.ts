import Joi from "joi";
import { ClientScope, JOI_GUID, ResponseWithRedirectBody } from "../../../common";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";

type RequestData = {
  id: string;
};

export const confirmLogoutSessionSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const confirmLogoutSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    axios: { oauthClient },
    data: { id },
  } = ctx;

  const { data } = await oauthClient.post<ResponseWithRedirectBody>(
    "/internal/sessions/logout/:id/confirm",
    {
      params: { id },
      middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.OAUTH_LOGOUT_WRITE])],
    },
  );

  return { body: data };
};
