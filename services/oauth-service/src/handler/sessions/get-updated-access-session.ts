import { AccessSession, AuthorizationSession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { uniqArray } from "@lindorm-io/core";

const createAccessSession = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
): Promise<AccessSession> => {
  const {
    repository: { accessSessionRepository },
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

  return await accessSessionRepository.create(
    new AccessSession({
      audiences: authorizationSession.confirmedConsent.audiences,
      browserSessionId: authorizationSession.browserSessionId,
      clientId: authorizationSession.clientId,
      identityId: authorizationSession.confirmedLogin.identityId,
      latestAuthentication: authorizationSession.confirmedLogin.latestAuthentication,
      levelOfAssurance: authorizationSession.confirmedLogin.levelOfAssurance,
      metadata: authorizationSession.confirmedLogin.metadata,
      methods: authorizationSession.confirmedLogin.methods,
      nonce: authorizationSession.nonce,
      scopes: authorizationSession.confirmedConsent.scopes,
    }),
  );
};

const updateAccessSession = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
  accessSession: AccessSession,
): Promise<AccessSession> => {
  const {
    repository: { accessSessionRepository },
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

  accessSession.audiences = uniqArray(
    accessSession.audiences,
    authorizationSession.confirmedConsent.audiences,
  );

  accessSession.latestAuthentication = authorizationSession.confirmedLogin.latestAuthentication;

  accessSession.levelOfAssurance =
    authorizationSession.confirmedLogin.levelOfAssurance > accessSession.levelOfAssurance
      ? authorizationSession.confirmedLogin.levelOfAssurance
      : accessSession.levelOfAssurance;

  accessSession.methods = uniqArray(
    accessSession.methods,
    authorizationSession.confirmedLogin.methods,
  );

  accessSession.nonce = authorizationSession.nonce;

  accessSession.scopes = uniqArray(
    accessSession.scopes,
    authorizationSession.confirmedConsent.scopes,
  );

  return await accessSessionRepository.update(accessSession);
};

export const getUpdatedAccessSession = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
): Promise<AccessSession> => {
  const {
    repository: { accessSessionRepository },
  } = ctx;

  if (!authorizationSession.accessSessionId) {
    return await createAccessSession(ctx, authorizationSession);
  }

  const accessSession = await accessSessionRepository.find({
    id: authorizationSession.accessSessionId,
  });

  if (accessSession.identityId !== authorizationSession.confirmedLogin.identityId) {
    return await createAccessSession(ctx, authorizationSession);
  }

  return await updateAccessSession(ctx, authorizationSession, accessSession);
};
