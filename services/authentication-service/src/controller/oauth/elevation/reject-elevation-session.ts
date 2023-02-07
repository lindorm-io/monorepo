import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import { RejectElevationRequestParams } from "@lindorm-io/common-types";
import { ClientScopes } from "../../../common";

type RequestData = RejectElevationRequestParams;

export const rejectElevationSessionSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
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
      clientCredentialsMiddleware(oauthClient, [ClientScopes.OAUTH_AUTHENTICATION_WRITE]),
    ],
  });
};
