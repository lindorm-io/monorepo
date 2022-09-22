import Joi from "joi";
import { ClientScope, JOI_GUID } from "../../../common";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";

type RequestData = {
  id: string;
};

export const rejectElevationSessionSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const rejectElevationSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    axios: { oauthClient },
    data: { id },
  } = ctx;

  await oauthClient.post("/internal/sessions/elevation/:id/reject", {
    params: { id },
    middleware: [
      clientCredentialsMiddleware(oauthClient, [ClientScope.OAUTH_AUTHENTICATION_WRITE]),
    ],
  });
};
