import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { GetLogoutRequestParams, GetLogoutResponse } from "@lindorm-io/common-types";
import { ServerError } from "@lindorm-io/errors";

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
    entity: { client, logoutSession, tenant },
    mongo: { browserSessionRepository, clientSessionRepository },
  } = ctx;

  if (!logoutSession.requestedLogout.browserSessionId) {
    throw new ServerError("Browser session not found");
  }

  const browserSession = await browserSessionRepository.find({
    id: logoutSession.requestedLogout.browserSessionId,
  });

  const clientSessions = browserSession
    ? await clientSessionRepository.findMany({
        browserSessionId: browserSession.id,
      })
    : [];

  const clientSession = logoutSession.requestedLogout.clientSessionId
    ? await clientSessionRepository.find({
        id: logoutSession.requestedLogout.clientSessionId,
      })
    : undefined;

  return {
    body: {
      logout: {
        status: logoutSession.status,

        browserSession: {
          id: browserSession.id,
          connectedSessions: clientSessions.filter((x) => x.id !== clientSession?.id).length,
        },
        clientSession: {
          id: clientSession?.id || null,
        },
      },

      logoutSession: {
        id: logoutSession.id,
        expires: logoutSession.expires.toISOString(),
        idTokenHint: logoutSession.idTokenHint,
        identityId: logoutSession.identityId,
        logoutHint: logoutSession.logoutHint,
        originalUri: logoutSession.originalUri,
        uiLocales: logoutSession.uiLocales,
      },

      client: {
        id: client.id,
        name: client.name,
        logoUri: client.logoUri,
        type: client.type,
      },

      tenant: {
        id: tenant.id,
        name: tenant.name,
      },
    },
  };
};
