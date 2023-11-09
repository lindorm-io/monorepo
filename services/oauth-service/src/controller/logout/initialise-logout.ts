import { OpenIdDisplayMode } from "@lindorm-io/common-enums";
import { InitialiseLogoutRequestData } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { expiryDate } from "@lindorm-io/expiry";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { JOI_JWT, JOI_STATE } from "../../common";
import { LogoutSession } from "../../entity";
import { tryFindBrowserSessions } from "../../handler";
import { configuration } from "../../server/configuration";
import { ServerKoaController } from "../../types";
import { assertPostLogoutRedirectUri, createLogoutPendingUri } from "../../util";

type RequestData = InitialiseLogoutRequestData;

export const oauthLogoutSchema = Joi.object<RequestData>()
  .keys({
    clientId: Joi.string().guid(),
    displayMode: Joi.string().valid(...Object.values(OpenIdDisplayMode)),
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
    redis: { logoutSessionCache },
    data: {
      clientId,
      displayMode,
      idTokenHint,
      logoutHint,
      postLogoutRedirectUri,
      state,
      uiLocales,
    },
    mongo: { clientRepository, clientSessionRepository },
    request: { originalUrl },
    token: { idToken },
  } = ctx;

  if (clientId && idToken && clientId !== idToken.metadata.client) {
    throw new ClientError("Invalid Client ID", {
      code: "invalid_client_id",
      debug: {
        expect: idToken.metadata.client,
        actual: clientId,
      },
    });
  }

  const combinedClientId = clientId || idToken?.metadata.client;

  if (!combinedClientId) {
    throw new ClientError("Client not found", {
      code: "client_not_found",
      description: "Unable to establish client [ clientId | idTokenHint ]",
      data: { clientId, idTokenHint },
    });
  }

  const client = await clientRepository.find({ id: combinedClientId });

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

  const clientSession = await clientSessionRepository.tryFind({
    browserSessionId: browserSession.id,
    clientId: client.id,
  });

  const expires = expiryDate(configuration.defaults.expiry.logout_session);

  const logoutSession = await logoutSessionCache.create(
    new LogoutSession({
      requestedLogout: {
        browserSessionId: browserSession.id,
        clientSessionId: clientSession?.id || null,
      },

      clientId: client.id,
      displayMode,
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
