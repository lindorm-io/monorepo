import { uniqArray } from "@lindorm-io/core";
import { ServerError } from "@lindorm-io/errors";
import { AuthorizationRequest, BrowserSession } from "../../entity";
import { ServerKoaContext } from "../../types";

const createBrowserSession = async (
  ctx: ServerKoaContext,
  authorizationRequest: AuthorizationRequest,
): Promise<BrowserSession> => {
  const {
    mongo: { browserSessionRepository },
  } = ctx;

  if (
    !authorizationRequest.confirmedLogin.identityId ||
    !authorizationRequest.confirmedLogin.latestAuthentication ||
    !authorizationRequest.confirmedLogin.levelOfAssurance ||
    !authorizationRequest.confirmedLogin.methods.length
  ) {
    throw new ServerError("Unexpected session data", {
      description: "Authorization session has invalid data",
      debug: {
        confirmedLogin: authorizationRequest.confirmedLogin,
      },
    });
  }

  return await browserSessionRepository.create(
    new BrowserSession({
      identityId: authorizationRequest.confirmedLogin.identityId,
      latestAuthentication: authorizationRequest.confirmedLogin.latestAuthentication,
      levelOfAssurance: authorizationRequest.confirmedLogin.levelOfAssurance,
      metadata: authorizationRequest.confirmedLogin.metadata,
      methods: authorizationRequest.confirmedLogin.methods,
      remember: authorizationRequest.confirmedLogin.remember,
      singleSignOn: authorizationRequest.confirmedLogin.singleSignOn,
    }),
  );
};

const updateBrowserSession = async (
  ctx: ServerKoaContext,
  authorizationRequest: AuthorizationRequest,
  browserSession: BrowserSession,
): Promise<BrowserSession> => {
  const {
    mongo: { browserSessionRepository },
  } = ctx;

  if (
    !authorizationRequest.confirmedLogin.identityId ||
    !authorizationRequest.confirmedLogin.latestAuthentication ||
    !authorizationRequest.confirmedLogin.levelOfAssurance ||
    !authorizationRequest.confirmedLogin.methods.length
  ) {
    throw new ServerError("Unexpected session data", {
      description: "Authorization session has invalid data",
      debug: {
        confirmedLogin: authorizationRequest.confirmedLogin,
      },
    });
  }

  browserSession.latestAuthentication = authorizationRequest.confirmedLogin.latestAuthentication;

  browserSession.levelOfAssurance =
    authorizationRequest.confirmedLogin.levelOfAssurance > browserSession.levelOfAssurance
      ? authorizationRequest.confirmedLogin.levelOfAssurance
      : browserSession.levelOfAssurance;

  browserSession.methods = uniqArray(
    browserSession.methods,
    authorizationRequest.confirmedLogin.methods,
  );

  browserSession.remember = browserSession.remember
    ? browserSession.remember
    : authorizationRequest.confirmedLogin.remember;

  browserSession.singleSignOn = browserSession.singleSignOn
    ? browserSession.singleSignOn
    : authorizationRequest.confirmedLogin.singleSignOn;

  return await browserSessionRepository.update(browserSession);
};

export const getUpdatedBrowserSession = async (
  ctx: ServerKoaContext,
  authorizationRequest: AuthorizationRequest,
): Promise<BrowserSession> => {
  const {
    mongo: { browserSessionRepository },
  } = ctx;

  if (!authorizationRequest.browserSessionId) {
    return await createBrowserSession(ctx, authorizationRequest);
  }

  const browserSession = await browserSessionRepository.find({
    id: authorizationRequest.browserSessionId,
  });

  if (browserSession.identityId !== authorizationRequest.confirmedLogin.identityId) {
    return await createBrowserSession(ctx, authorizationRequest);
  }

  return await updateBrowserSession(ctx, authorizationRequest, browserSession);
};
