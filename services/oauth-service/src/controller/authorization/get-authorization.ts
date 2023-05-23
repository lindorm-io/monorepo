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
    entity: { authorizationRequest, client, tenant },
    mongo: { browserSessionRepository, clientSessionRepository },
  } = ctx;

  const browserSession = authorizationRequest.browserSessionId
    ? await browserSessionRepository.tryFind({ id: authorizationRequest.browserSessionId })
    : undefined;

  const clientSession = authorizationRequest.clientSessionId
    ? await clientSessionRepository.tryFind({ id: authorizationRequest.clientSessionId })
    : undefined;

  const selectAccountRequired = isSelectAccountRequired(ctx, authorizationRequest);
  const loginRequired = isLoginRequired(ctx, authorizationRequest, browserSession, clientSession);
  const consentRequired = isConsentRequired(
    ctx,
    authorizationRequest,
    browserSession,
    clientSession,
  );

  return {
    body: {
      consent: {
        isRequired: consentRequired,
        status: authorizationRequest.status.consent,

        audiences: authorizationRequest.requestedConsent.audiences,
        optionalScopes: authorizationRequest.requestedConsent.scopes.filter(
          (x) => !client.requiredScopes.includes(x),
        ),
        requiredScopes: client.requiredScopes,
        scopeDescriptions: client.scopeDescriptions,
      },

      login: {
        isRequired: loginRequired,
        status: authorizationRequest.status.login,

        identityId: authorizationRequest.requestedLogin.identityId,
        minimumLevel: authorizationRequest.requestedLogin.minimumLevel,
        recommendedLevel: authorizationRequest.requestedLogin.recommendedLevel,
        recommendedMethods: authorizationRequest.requestedLogin.recommendedMethods,
        recommendedStrategies: authorizationRequest.requestedLogin.recommendedStrategies,
        requiredLevel: authorizationRequest.requestedLogin.requiredLevel,
        requiredMethods: authorizationRequest.requestedLogin.requiredMethods,
        requiredStrategies: authorizationRequest.requestedLogin.requiredStrategies,
      },

      selectAccount: {
        isRequired: selectAccountRequired,
        status: authorizationRequest.status.selectAccount,

        sessions: authorizationRequest.requestedSelectAccount.browserSessions.map((x) => ({
          selectId: x.browserSessionId,
          identityId: x.identityId,
        })),
      },

      authorizationRequest: {
        id: authorizationRequest.id,
        country: authorizationRequest.country,
        displayMode: authorizationRequest.displayMode,
        expires: authorizationRequest.expires.toISOString(),
        idTokenHint: authorizationRequest.idTokenHint,
        loginHint: authorizationRequest.loginHint,
        nonce: authorizationRequest.nonce,
        maxAge: authorizationRequest.maxAge,
        originalUri: authorizationRequest.originalUri,
        promptModes: authorizationRequest.promptModes,
        redirectUri: authorizationRequest.redirectUri,
        uiLocales: authorizationRequest.uiLocales,
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
