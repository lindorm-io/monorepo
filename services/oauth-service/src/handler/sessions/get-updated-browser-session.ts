import { AuthorizationSession, BrowserSession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { uniqArray } from "@lindorm-io/core";

const createBrowserSession = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
): Promise<BrowserSession> => {
  const {
    repository: { browserSessionRepository },
  } = ctx;

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

  return await browserSessionRepository.create(
    new BrowserSession({
      identityId: authorizationSession.confirmedLogin.identityId,
      latestAuthentication: authorizationSession.confirmedLogin.latestAuthentication,
      levelOfAssurance: authorizationSession.confirmedLogin.levelOfAssurance,
      methods: authorizationSession.confirmedLogin.methods,
      remember: authorizationSession.confirmedLogin.remember,
      sso: authorizationSession.confirmedLogin.sso,
    }),
  );
};

const updateBrowserSession = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
  browserSession: BrowserSession,
): Promise<BrowserSession> => {
  const {
    repository: { browserSessionRepository },
  } = ctx;

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

  browserSession.latestAuthentication = authorizationSession.confirmedLogin.latestAuthentication;

  browserSession.levelOfAssurance =
    authorizationSession.confirmedLogin.levelOfAssurance > browserSession.levelOfAssurance
      ? authorizationSession.confirmedLogin.levelOfAssurance
      : browserSession.levelOfAssurance;

  browserSession.methods = uniqArray(
    browserSession.methods,
    authorizationSession.confirmedLogin.methods,
  );

  browserSession.remember = browserSession.remember
    ? browserSession.remember
    : authorizationSession.confirmedLogin.remember;

  browserSession.sso = browserSession.sso
    ? browserSession.sso
    : authorizationSession.confirmedLogin.sso;

  return await browserSessionRepository.update(browserSession);
};

export const getUpdatedBrowserSession = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
): Promise<BrowserSession> => {
  const {
    repository: { browserSessionRepository },
  } = ctx;

  if (!authorizationSession.browserSessionId) {
    return await createBrowserSession(ctx, authorizationSession);
  }

  const browserSession = await browserSessionRepository.find({
    id: authorizationSession.browserSessionId,
  });

  if (browserSession.identityId !== authorizationSession.confirmedLogin.identityId) {
    return await createBrowserSession(ctx, authorizationSession);
  }

  return await updateBrowserSession(ctx, authorizationSession, browserSession);
};
