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
    repository: { accessSessionRepository, browserSessionRepository, refreshSessionRepository },
  } = ctx;

  if (!logoutSession.requestedLogout.browserSessionId) {
    throw new ServerError("Browser session not found");
  }

  const browserSession = await browserSessionRepository.find({
    id: logoutSession.requestedLogout.browserSessionId,
  });

  const accessSessions = browserSession
    ? await accessSessionRepository.findMany({
        browserSessionId: browserSession.id,
      })
    : [];

  const accessSession = logoutSession.requestedLogout.accessSessionId
    ? accessSessions.find((x) => x.id === logoutSession.requestedLogout.accessSessionId)
    : undefined;

  const refreshSession = logoutSession.requestedLogout.refreshSessionId
    ? await refreshSessionRepository.find({
        id: logoutSession.requestedLogout.refreshSessionId,
      })
    : undefined;

  return {
    body: {
      logout: {
        status: logoutSession.status,

        accessSession: {
          id: accessSession?.id || null,
        },
        browserSession: {
          id: browserSession.id,
          connectedSessions: accessSessions.filter((x) => x.id !== accessSession?.id).length,
        },
        refreshSession: {
          id: refreshSession?.id || null,
        },
      },

      client: {
        name: client.name,
        logoUri: client.logoUri,
        type: client.type,
        tenant: tenant.name,
      },

      logoutSession: {
        expires: logoutSession.expires.toISOString(),
        idTokenHint: logoutSession.idTokenHint,
        identityId: logoutSession.identityId,
        logoutHint: logoutSession.logoutHint,
        originalUri: logoutSession.originalUri,
        uiLocales: logoutSession.uiLocales,
      },
    },
  };
};
