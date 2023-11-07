import { uniqArray } from "@lindorm-io/core";
import { ServerError } from "@lindorm-io/errors";
import { AuthorizationSession, BrowserSession } from "../../entity";
import { ServerKoaContext } from "../../types";

const createBrowserSession = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
): Promise<BrowserSession> => {
  const {
    mongo: { browserSessionRepository },
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
      factors: authorizationSession.confirmedLogin.factors,
      identityId: authorizationSession.confirmedLogin.identityId,
      latestAuthentication: authorizationSession.confirmedLogin.latestAuthentication,
      levelOfAssurance: authorizationSession.confirmedLogin.levelOfAssurance,
      metadata: authorizationSession.confirmedLogin.metadata,
      methods: authorizationSession.confirmedLogin.methods,
      remember: authorizationSession.confirmedLogin.remember,
      singleSignOn: authorizationSession.confirmedLogin.singleSignOn,
      strategies: authorizationSession.confirmedLogin.strategies,
    }),
  );
};

const updateBrowserSession = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
  browserSession: BrowserSession,
): Promise<BrowserSession> => {
  const {
    mongo: { browserSessionRepository },
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

  browserSession.factors = uniqArray(
    browserSession.factors,
    authorizationSession.confirmedLogin.factors,
  );

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

  browserSession.strategies = uniqArray(
    browserSession.strategies,
    authorizationSession.confirmedLogin.strategies,
  );

  browserSession.singleSignOn = browserSession.singleSignOn
    ? browserSession.singleSignOn
    : authorizationSession.confirmedLogin.singleSignOn;

  return await browserSessionRepository.update(browserSession);
};

export const getUpdatedBrowserSession = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
): Promise<BrowserSession> => {
  const {
    mongo: { browserSessionRepository },
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
