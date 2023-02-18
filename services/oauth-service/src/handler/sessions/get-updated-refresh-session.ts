import { RefreshSession, AuthorizationSession, Client } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { uniqArray } from "@lindorm-io/core";
import { expiryDate } from "@lindorm-io/expiry";
import { configuration } from "../../server/configuration";

const createRefreshSession = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
  client: Client,
): Promise<RefreshSession> => {
  const {
    repository: { refreshSessionRepository },
  } = ctx;

  if (!authorizationSession.browserSessionId) {
    throw new ServerError("Invalid Session", {
      code: "invalid_session",
      description: "Session data is missing",
      data: { browserSessionId: authorizationSession.browserSessionId },
    });
  }

  if (
    !authorizationSession.confirmedLogin.identityId ||
    !authorizationSession.confirmedLogin.latestAuthentication ||
    !authorizationSession.confirmedLogin.levelOfAssurance ||
    !authorizationSession.confirmedLogin.methods.length
  ) {
    throw new ServerError("Unexpected session data", {
      description: "Authorization session has invalid data",
      debug: { confirmedLogin: authorizationSession.confirmedLogin },
    });
  }

  if (
    !authorizationSession.confirmedConsent.audiences.length ||
    !authorizationSession.confirmedConsent.scopes.length
  ) {
    throw new ServerError("Unexpected session data", {
      description: "Authorization session has invalid data",
      debug: { confirmedConsent: authorizationSession.confirmedConsent },
    });
  }

  return await refreshSessionRepository.create(
    new RefreshSession({
      audiences: authorizationSession.confirmedConsent.audiences,
      browserSessionId: authorizationSession.browserSessionId,
      clientId: authorizationSession.clientId,
      identityId: authorizationSession.confirmedLogin.identityId,
      expires: expiryDate(
        client.expiry.refreshToken || configuration.defaults.expiry.refresh_session,
      ),
      latestAuthentication: authorizationSession.confirmedLogin.latestAuthentication,
      levelOfAssurance: authorizationSession.confirmedLogin.levelOfAssurance,
      methods: authorizationSession.confirmedLogin.methods,
      nonce: authorizationSession.nonce,
      scopes: authorizationSession.confirmedConsent.scopes,
    }),
  );
};

const updateRefreshSession = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
  client: Client,
  refreshSession: RefreshSession,
): Promise<RefreshSession> => {
  const {
    repository: { refreshSessionRepository },
  } = ctx;

  if (!authorizationSession.browserSessionId) {
    throw new ServerError("Invalid Session", {
      code: "invalid_session",
      description: "Session data is missing",
      data: { browserSessionId: authorizationSession.browserSessionId },
    });
  }

  if (
    !authorizationSession.confirmedLogin.identityId ||
    !authorizationSession.confirmedLogin.latestAuthentication ||
    !authorizationSession.confirmedLogin.levelOfAssurance ||
    !authorizationSession.confirmedLogin.methods.length
  ) {
    throw new ServerError("Unexpected session data", {
      description: "Authorization session has invalid data",
      debug: {
        confirmedLogin: authorizationSession.confirmedLogin,
      },
    });
  }

  if (
    !authorizationSession.confirmedConsent.audiences.length ||
    !authorizationSession.confirmedConsent.scopes.length
  ) {
    throw new ServerError("Unexpected session data", {
      description: "Authorization session has invalid data",
      debug: { confirmedConsent: authorizationSession.confirmedConsent },
    });
  }

  refreshSession.audiences = uniqArray(
    refreshSession.audiences,
    authorizationSession.confirmedConsent.audiences,
  );

  refreshSession.expires = expiryDate(
    client.expiry.refreshToken || configuration.defaults.expiry.refresh_session,
  );

  refreshSession.latestAuthentication = authorizationSession.confirmedLogin.latestAuthentication;

  refreshSession.levelOfAssurance =
    authorizationSession.confirmedLogin.levelOfAssurance > refreshSession.levelOfAssurance
      ? authorizationSession.confirmedLogin.levelOfAssurance
      : refreshSession.levelOfAssurance;

  refreshSession.methods = uniqArray(
    refreshSession.methods,
    authorizationSession.confirmedLogin.methods,
  );

  refreshSession.nonce = authorizationSession.nonce;

  refreshSession.scopes = uniqArray(
    refreshSession.scopes,
    authorizationSession.confirmedConsent.scopes,
  );

  return await refreshSessionRepository.update(refreshSession);
};

export const getUpdatedRefreshSession = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
  client: Client,
): Promise<RefreshSession> => {
  const {
    repository: { refreshSessionRepository },
  } = ctx;

  if (!authorizationSession.refreshSessionId) {
    return await createRefreshSession(ctx, authorizationSession, client);
  }

  const refreshSession = await refreshSessionRepository.find({
    id: authorizationSession.refreshSessionId,
  });

  if (refreshSession.identityId !== authorizationSession.confirmedLogin.identityId) {
    return await createRefreshSession(ctx, authorizationSession, client);
  }

  return await updateRefreshSession(ctx, authorizationSession, client, refreshSession);
};
