import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { GetAuthorizationRequestParams, GetAuthorizationResponse } from "@lindorm-io/common-types";
import { ServerKoaController } from "../../types";
import { expiryObject } from "@lindorm-io/expiry";
import {
  getAdjustedAccessLevel,
  isConsentRequired,
  isLoginRequired,
  isSelectAccountRequired,
} from "../../util";

type RequestData = GetAuthorizationRequestParams;

type ResponseBody = GetAuthorizationResponse;

export const getAuthorizationSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getAuthorizationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { authorizationSession, client, tenant },
    repository: { accessSessionRepository, browserSessionRepository, refreshSessionRepository },
  } = ctx;

  const { expires, expiresIn } = expiryObject(authorizationSession.expires);

  const accessSession = authorizationSession.accessSessionId
    ? await accessSessionRepository.tryFind({ id: authorizationSession.accessSessionId })
    : undefined;

  const browserSession = authorizationSession.browserSessionId
    ? await browserSessionRepository.tryFind({ id: authorizationSession.browserSessionId })
    : undefined;

  const refreshSession = authorizationSession.refreshSessionId
    ? await refreshSessionRepository.tryFind({ id: authorizationSession.refreshSessionId })
    : undefined;

  const consentRequired = isConsentRequired(
    authorizationSession,
    browserSession,
    accessSession,
    refreshSession,
  );

  const loginRequired = isLoginRequired(
    authorizationSession,
    browserSession,
    accessSession,
    refreshSession,
  );

  const selectAccountRequired = isSelectAccountRequired(authorizationSession);

  return {
    body: {
      consent: {
        isRequired: consentRequired,
        status: authorizationSession.status.consent,

        audiences: authorizationSession.requestedConsent.audiences,
        optionalScopes: authorizationSession.requestedConsent.scopes.filter(
          (x) => !client.requiredScopes.includes(x),
        ),
        requiredScopes: client.requiredScopes,
        scopeDescriptions: client.scopeDescriptions,
      },

      login: {
        isRequired: loginRequired,
        status: authorizationSession.status.login,

        identityId: authorizationSession.requestedLogin.identityId,
        minimumLevel: authorizationSession.requestedLogin.minimumLevel,
        recommendedLevel: authorizationSession.requestedLogin.recommendedLevel,
        recommendedMethods: authorizationSession.requestedLogin.recommendedMethods,
        requiredLevel: authorizationSession.requestedLogin.requiredLevel,
        requiredMethods: authorizationSession.requestedLogin.requiredMethods,
      },

      selectAccount: {
        isRequired: selectAccountRequired,
        status: authorizationSession.status.selectAccount,

        sessions: authorizationSession.requestedSelectAccount.browserSessions.map((x) => ({
          selectId: x.browserSessionId,
          identityId: x.identityId,
        })),
      },

      accessSession: {
        methods: accessSession?.methods || [],
        adjustedAccessLevel: accessSession ? getAdjustedAccessLevel(accessSession) : 0,
        audiences: accessSession?.audiences || [],
        identityId: accessSession?.identityId || null,
        latestAuthentication: accessSession?.latestAuthentication.toISOString() || null,
        levelOfAssurance: accessSession?.levelOfAssurance || 0,
        scopes: accessSession?.scopes || [],
      },

      authorizationSession: {
        authToken: authorizationSession.authToken,
        country: authorizationSession.country,
        displayMode: authorizationSession.displayMode,
        expiresAt: expires.toISOString(),
        expiresIn,
        idTokenHint: authorizationSession.idTokenHint,
        loginHint: authorizationSession.loginHint,
        nonce: authorizationSession.nonce,
        maxAge: authorizationSession.maxAge,
        originalUri: authorizationSession.originalUri,
        promptModes: authorizationSession.promptModes,
        redirectUri: authorizationSession.redirectUri,
        uiLocales: authorizationSession.uiLocales,
      },

      browserSession: {
        adjustedAccessLevel: browserSession ? getAdjustedAccessLevel(browserSession) : 0,
        identityId: browserSession?.identityId || null,
        latestAuthentication: browserSession?.latestAuthentication.toISOString() || null,
        levelOfAssurance: browserSession?.levelOfAssurance || 0,
        methods: browserSession?.methods || [],
        remember: browserSession?.remember || false,
        sso: browserSession?.sso || false,
      },

      client: {
        name: client.name,
        logoUri: client.logoUri,
        type: client.type,
        tenant: tenant.name,
      },

      refreshSession: {
        adjustedAccessLevel: refreshSession ? getAdjustedAccessLevel(refreshSession) : 0,
        audiences: refreshSession?.audiences || [],
        identityId: refreshSession?.identityId || null,
        latestAuthentication: refreshSession?.latestAuthentication.toISOString() || null,
        levelOfAssurance: refreshSession?.levelOfAssurance || 0,
        methods: refreshSession?.methods || [],
        scopes: refreshSession?.scopes || [],
      },
    },
  };
};
