import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { expiryObject } from "@lindorm-io/expiry";
import { GetLogoutRequestParams, GetLogoutResponse } from "@lindorm-io/common-types";

type RequestData = GetLogoutRequestParams;

type ResponseBody = GetLogoutResponse;

export const getLogoutSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getLogoutController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { client, logoutSession },
  } = ctx;

  const { expires, expiresIn } = expiryObject(logoutSession.expires);

  return {
    body: {
      logout: {
        accessSessionId: logoutSession.requestedLogout.accessSessionId,
        accessSessions: logoutSession.requestedLogout.accessSessions,
        browserSessionId: logoutSession.requestedLogout.browserSessionId,
        refreshSessionId: logoutSession.requestedLogout.refreshSessionId,
        refreshSessions: logoutSession.requestedLogout.refreshSessions,
      },

      client: {
        description: client.description,
        logoUri: client.logoUri,
        name: client.name,
        type: client.type,
      },
      logoutSession: {
        clientId: logoutSession.clientId,
        expiresAt: expires.toISOString(),
        expiresIn,
        idTokenHint: logoutSession.idTokenHint,
        identityId: logoutSession.identityId,
        logoutHint: logoutSession.logoutHint,
        originalUri: logoutSession.originalUri,
        uiLocales: logoutSession.uiLocales,
      },
    },
  };
};
