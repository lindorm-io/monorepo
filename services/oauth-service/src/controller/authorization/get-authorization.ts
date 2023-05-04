import { GetAuthorizationRequestParams, GetAuthorizationResponse } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { isConsentRequired, isLoginRequired, isSelectAccountRequired } from "../../handler";
import { ServerKoaController } from "../../types";
import { getAdjustedAccessLevel } from "../../util";

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
    mongo: { browserSessionRepository, clientSessionRepository },
  } = ctx;

  const browserSession = authorizationSession.browserSessionId
    ? await browserSessionRepository.tryFind({ id: authorizationSession.browserSessionId })
    : undefined;

  const clientSession = authorizationSession.clientSessionId
    ? await clientSessionRepository.tryFind({ id: authorizationSession.clientSessionId })
    : undefined;

  const selectAccountRequired = isSelectAccountRequired(ctx, authorizationSession);
  const loginRequired = isLoginRequired(ctx, authorizationSession, browserSession, clientSession);
  const consentRequired = isConsentRequired(
    ctx,
    authorizationSession,
    browserSession,
    clientSession,
  );

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

      authorizationSession: {
        id: authorizationSession.id,
        authToken: authorizationSession.authToken,
        country: authorizationSession.country,
        displayMode: authorizationSession.displayMode,
        expires: authorizationSession.expires.toISOString(),
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
        id: browserSession?.id || null,
        adjustedAccessLevel: browserSession ? getAdjustedAccessLevel(browserSession) : 0,
        identityId: browserSession?.identityId || null,
        latestAuthentication: browserSession?.latestAuthentication.toISOString() || null,
        levelOfAssurance: browserSession?.levelOfAssurance || 0,
        methods: browserSession?.methods || [],
        remember: browserSession?.remember || false,
        singleSignOn: browserSession?.singleSignOn || false,
      },

      clientSession: {
        id: clientSession?.id || null,
        adjustedAccessLevel: clientSession ? getAdjustedAccessLevel(clientSession) : 0,
        audiences: clientSession?.audiences || [],
        identityId: clientSession?.identityId || null,
        latestAuthentication: clientSession?.latestAuthentication.toISOString() || null,
        levelOfAssurance: clientSession?.levelOfAssurance || 0,
        methods: clientSession?.methods || [],
        scopes: clientSession?.scopes || [],
      },

      client: {
        id: client.id,
        name: client.name,
        logoUri: client.logoUri,
        singleSignOn: client.singleSignOn,
        type: client.type,
      },

      tenant: {
        id: tenant.id,
        name: tenant.name,
      },
    },
  };
};
