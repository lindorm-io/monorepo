import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { expiryObject } from "@lindorm-io/expiry";
import { GetLogoutRequestParams, GetLogoutResponse } from "@lindorm-io/common-types";

type RequestData = GetLogoutRequestParams;

type ResponseBody = GetLogoutResponse;

export const getLogoutDataSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getLogoutDataController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { client, logoutSession },
  } = ctx;

  const { expires, expiresIn } = expiryObject(logoutSession.expires);

  return {
    body: {
      client: {
        description: client.description,
        logoUri: client.logoUri,
        name: client.name,
        type: client.type,
      },
      logoutSession: {
        id: logoutSession.id,
        expiresAt: expires.toISOString(),
        expiresIn,
        originalUri: logoutSession.originalUri,
      },
      logoutStatus: logoutSession.status,
    },
  };
};
