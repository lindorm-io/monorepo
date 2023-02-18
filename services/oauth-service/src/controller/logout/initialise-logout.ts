import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { InitialiseLogoutRequestData } from "@lindorm-io/common-types";
import { JOI_JWT, JOI_STATE } from "../../common";
import { LogoutSession } from "../../entity";
import { ServerKoaController } from "../../types";
import { assertPostLogoutRedirectUri, createLogoutPendingUri } from "../../util";
import { configuration } from "../../server/configuration";
import { expiryDate } from "@lindorm-io/expiry";
import { tryFindBrowserSessions } from "../../handler";

type RequestData = InitialiseLogoutRequestData;

export const oauthLogoutSchema = Joi.object<RequestData>()
  .keys({
    clientId: Joi.string().guid(),
    idTokenHint: JOI_JWT,
    logoutHint: Joi.string(),
    postLogoutRedirectUri: Joi.string().uri(),
    state: JOI_STATE,
    uiLocales: Joi.string(),
  })
  .required();

export const oauthLogoutController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { clientCache, logoutSessionCache },
    data: { clientId, idTokenHint, logoutHint, postLogoutRedirectUri, state, uiLocales },
    repository: { accessSessionRepository, refreshSessionRepository },
    request: { originalUrl },
    token: { idToken },
  } = ctx;

  if (clientId && idToken && clientId !== idToken.client) {
    throw new ClientError("Invalid Client ID", {
      code: "invalid_client_id",
      debug: {
        expect: idToken.client,
        actual: clientId,
      },
    });
  }

  const combinedClientId = clientId || idToken?.client;

  if (!combinedClientId) {
    throw new ClientError("Client not found", {
      code: "client_not_found",
      description: "Unable to establish client [ clientId | idTokenHint ]",
      data: { clientId, idTokenHint },
    });
  }

  const client = await clientCache.find({ id: combinedClientId });

  if (!client.active) {
    throw new ClientError("Inactive Client", {
      code: "inactive_client",
      statusCode: ClientError.StatusCode.FORBIDDEN,
    });
  }

  if (postLogoutRedirectUri) {
    assertPostLogoutRedirectUri(client, postLogoutRedirectUri);
  }

  const browserSessions = await tryFindBrowserSessions(ctx, idToken);
  const browserSession = browserSessions.length === 1 ? browserSessions[0] : undefined;

  if (!browserSession) {
    throw new ClientError("Browser session not found", {
      code: "browser_session_not_found",
      description: "Unable to establish browser session [ idTokenHint ]",
      data: { idTokenHint },
    });
  }

  const accessSessions = await accessSessionRepository.findMany({
    browserSessionId: browserSession.id,
  });
  const refreshSessions = await refreshSessionRepository.findMany({
    browserSessionId: browserSession.id,
  });

  const accessSession = accessSessions.find((x) => x.clientId === client.id);
  const refreshSession = refreshSessions.find((x) => x.clientId === client.id);

  const expires = expiryDate(configuration.defaults.expiry.logout_session);

  const logoutSession = await logoutSessionCache.create(
    new LogoutSession({
      requestedLogout: {
        accessSessionId: accessSession?.id || null,
        accessSessions: accessSessions.map((x) => x.id),
        browserSessionId: browserSession.id,
        refreshSessionId: refreshSession?.id || null,
        refreshSessions: refreshSessions.map((x) => x.id),
      },

      clientId: client.id,
      expires,
      idTokenHint: idToken ? idToken.token : null,
      identityId: browserSession.identityId,
      logoutHint,
      originalUri: new URL(originalUrl, configuration.server.host).toString(),
      postLogoutRedirectUri,
      state,
      uiLocales: uiLocales?.split(" "),
    }),
  );

  return { redirect: createLogoutPendingUri(logoutSession) };
};
