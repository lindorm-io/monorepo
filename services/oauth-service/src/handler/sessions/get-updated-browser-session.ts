import { AuthorizationSession, BrowserSession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { configuration } from "../../server/configuration";
import { expiryDate } from "@lindorm-io/expiry";
import { SessionStatuses } from "@lindorm-io/common-types";

const assertAuthorizationSession = (authorizationSession: AuthorizationSession): void => {
  if (
    authorizationSession.confirmedLogin.acrValues.length &&
    authorizationSession.confirmedLogin.amrValues.length &&
    authorizationSession.confirmedLogin.identityId &&
    authorizationSession.confirmedLogin.latestAuthentication &&
    authorizationSession.confirmedLogin.levelOfAssurance > 0
  ) {
    return;
  }

  throw new ServerError("Unexpected session data", {
    description: "Authorization session has invalid login data",
    debug: {
      confirmedLogin: authorizationSession.confirmedLogin,
    },
  });
};

const calculateExpiryDate = (remember: boolean): Date => {
  return remember === true
    ? expiryDate(configuration.defaults.expiry.browser_session_remember)
    : expiryDate(configuration.defaults.expiry.browser_session);
};

const createBrowserSession = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
): Promise<BrowserSession> => {
  const {
    repository: { browserSessionRepository },
  } = ctx;

  assertAuthorizationSession(authorizationSession);

  return await browserSessionRepository.create(
    new BrowserSession({
      acrValues: authorizationSession.confirmedLogin.acrValues,
      amrValues: authorizationSession.confirmedLogin.amrValues,
      clients: [authorizationSession.clientId],
      country: authorizationSession.country,
      expires: calculateExpiryDate(authorizationSession.confirmedLogin.remember),
      identityId: authorizationSession.confirmedLogin.identityId,
      latestAuthentication: authorizationSession.confirmedLogin.latestAuthentication,
      levelOfAssurance: authorizationSession.confirmedLogin.levelOfAssurance,
      nonce: authorizationSession.nonce,
      remember: authorizationSession.confirmedLogin.remember,
      uiLocales: authorizationSession.uiLocales,
    }),
  );
};

export const getUpdatedBrowserSession = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
): Promise<BrowserSession> => {
  const {
    repository: { browserSessionRepository },
  } = ctx;

  if (!authorizationSession.identifiers.browserSessionId) {
    return await createBrowserSession(ctx, authorizationSession);
  }

  const browserSession = await browserSessionRepository.find({
    id: authorizationSession.identifiers.browserSessionId,
  });

  if (authorizationSession.status.login === SessionStatuses.SKIP) {
    browserSession.expires = calculateExpiryDate(browserSession.remember);

    return await browserSessionRepository.update(browserSession);
  }

  if (browserSession.identityId !== authorizationSession.confirmedLogin.identityId) {
    return await createBrowserSession(ctx, authorizationSession);
  }

  assertAuthorizationSession(authorizationSession);

  browserSession.acrValues = authorizationSession.confirmedLogin.acrValues;
  browserSession.amrValues = authorizationSession.confirmedLogin.amrValues;
  browserSession.country = authorizationSession.country;
  browserSession.expires = calculateExpiryDate(authorizationSession.confirmedLogin.remember);
  browserSession.latestAuthentication = authorizationSession.confirmedLogin.latestAuthentication;
  browserSession.levelOfAssurance = authorizationSession.confirmedLogin.levelOfAssurance;
  browserSession.nonce = authorizationSession.nonce;
  browserSession.remember = authorizationSession.confirmedLogin.remember;

  return await browserSessionRepository.update(browserSession);
};
