import {
  AuthorizeRequestQuery,
  LindormScope,
  OpenIdPromptMode,
  OpenIdResponseType,
  OpenIdScope,
  SessionStatus,
} from "@lindorm-io/common-types";
import { removeEmptyFromArray, uniqArray } from "@lindorm-io/core";
import { ClientError } from "@lindorm-io/errors";
import { expiryDate } from "@lindorm-io/expiry";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { JOI_COUNTRY_CODE, JOI_NONCE, JOI_STATE } from "../../common";
import {
  JOI_DISPLAY_MODE,
  JOI_PKCE_METHOD,
  JOI_PROMPT_REGEX,
  JOI_RESPONSE_MODE,
  JOI_RESPONSE_TYPE_REGEX,
} from "../../constant";
import { AuthorizationRequest } from "../../entity";
import {
  isConsentRequired,
  isLoginRequired,
  isSelectAccountRequired,
  isSsoAvailable,
  setAuthorizationRequestCookie,
  tryFindBrowserSessions,
  tryFindClientSession,
} from "../../handler";
import { configuration } from "../../server/configuration";
import { ServerKoaController } from "../../types";
import {
  assertAuthorizePrompt,
  assertAuthorizeResponseType,
  assertAuthorizeScope,
  assertRedirectUri,
  createAuthorizationVerifyUri,
  createConsentPendingUri,
  createLoginPendingUri,
  createSelectAccountPendingUri,
  filterAcrValues,
} from "../../util";

type RequestData = AuthorizeRequestQuery;

export const oauthAuthorizeSchema = Joi.object<RequestData>()
  .keys({
    acrValues: Joi.string(),
    clientId: Joi.string().guid().required(),
    codeChallenge: Joi.string(),
    codeChallengeMethod: JOI_PKCE_METHOD,
    country: JOI_COUNTRY_CODE,
    display: JOI_DISPLAY_MODE,
    idTokenHint: Joi.string(),
    loginHint: Joi.string(),
    maxAge: Joi.string().pattern(/^\d+$/),
    nonce: JOI_NONCE,
    prompt: JOI_PROMPT_REGEX,
    redirectData: Joi.string().base64(),
    redirectUri: Joi.string().uri().required(),
    responseMode: JOI_RESPONSE_MODE,
    responseType: JOI_RESPONSE_TYPE_REGEX.required(),
    scope: Joi.string().required(),
    state: JOI_STATE.required(),
    uiLocales: Joi.string(),
  })
  .options({ abortEarly: false })
  .required();

export const oauthAuthorizeController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    redis: { authorizationRequestCache },
    data: {
      acrValues,
      codeChallenge,
      codeChallengeMethod,
      country,
      display,
      loginHint,
      maxAge,
      nonce,
      prompt,
      redirectData,
      redirectUri,
      responseMode,
      responseType,
      scope,
      state,
      uiLocales,
    },
    entity: { client },
    token: { idToken },
  } = ctx;

  if (!client.active) {
    throw new ClientError("Invalid client", {
      code: "invalid_request",
      description: "Client is blocked",
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  const prompts = prompt ? (prompt.toLowerCase().split(" ") as Array<OpenIdPromptMode>) : [];
  const responseTypes = responseType.toLowerCase().split(" ") as Array<OpenIdResponseType>;
  const scopes = scope.toLowerCase().split(" ") as Array<OpenIdScope | LindormScope>;

  assertRedirectUri(client, redirectUri);

  const expires = expiryDate(configuration.defaults.expiry.authorization_session);

  const {
    levelOfAssurance: requiredLevel,
    methods: requiredMethods,
    strategies: requiredStrategies,
  } = filterAcrValues({ acrString: acrValues });

  const {
    levelOfAssurance: recommendedLevel,
    methods: recommendedMethods,
    strategies: recommendedStrategies,
  } = filterAcrValues({
    acrArray: idToken?.authContextClass ? [idToken.authContextClass] : [],
    amrArray: idToken?.authMethodsReference,
  });

  const defaultAudiences = uniqArray(
    client.id,
    client.audiences.identity,
    configuration.oauth.client_id,
    configuration.services.authentication_service.client_id,
    configuration.services.identity_service.client_id,
  );

  const audiences = idToken ? uniqArray(idToken.audiences, defaultAudiences) : defaultAudiences;

  const browserSessions = await tryFindBrowserSessions(ctx, idToken);
  const browserSession = browserSessions.length === 1 ? browserSessions[0] : undefined;
  const clientSession = await tryFindClientSession(ctx, client, browserSession, idToken);

  let authorizationRequest = new AuthorizationRequest({
    code: {
      codeChallenge: codeChallenge || null,
      codeChallengeMethod: codeChallengeMethod || null,
    },
    requestedConsent: {
      audiences,
      scopes,
    },
    requestedLogin: {
      identityId: idToken ? idToken.subject : null,
      minimumLevel: client.defaults.levelOfAssurance,
      recommendedLevel,
      recommendedMethods,
      recommendedStrategies,
      requiredLevel,
      requiredMethods,
      requiredStrategies,
    },
    requestedSelectAccount: {
      browserSessions: browserSessions.map((x) => ({
        browserSessionId: x.id,
        identityId: x.identityId,
      })),
    },

    browserSessionId: browserSession?.id || null,
    clientId: client.id,
    clientSessionId: clientSession?.id || null,
    country,
    displayMode: display || client.defaults.displayMode,
    expires,
    idTokenHint: idToken ? idToken.token : null,
    loginHint: removeEmptyFromArray(
      uniqArray(
        loginHint,
        idToken?.claims?.email,
        idToken?.claims?.phoneNumber,
        idToken?.claims?.username,
      ),
    ),
    maxAge: maxAge ? parseInt(maxAge, 10) : null,
    nonce,
    originalUri: new URL(ctx.request.originalUrl, configuration.server.host).toString(),
    promptModes: prompts,
    redirectData,
    redirectUri,
    responseMode: responseMode || client.defaults.responseMode,
    responseTypes,
    state,
    uiLocales: uiLocales ? uiLocales.split(" ") : [],
  });

  const selectAccountRequired = isSelectAccountRequired(ctx, authorizationRequest);
  authorizationRequest.status.selectAccount = selectAccountRequired
    ? SessionStatus.PENDING
    : SessionStatus.SKIP;

  const loginRequired = isLoginRequired(ctx, authorizationRequest, browserSession, clientSession);
  authorizationRequest.status.login = loginRequired ? SessionStatus.PENDING : SessionStatus.SKIP;

  if (
    loginRequired &&
    browserSession &&
    isSsoAvailable(ctx, authorizationRequest, client, browserSession)
  ) {
    authorizationRequest.confirmLogin(browserSession);
  }

  const consentRequired = isConsentRequired(
    ctx,
    authorizationRequest,
    browserSession,
    clientSession,
  );
  authorizationRequest.status.consent = consentRequired
    ? SessionStatus.PENDING
    : SessionStatus.SKIP;

  assertAuthorizePrompt(authorizationRequest, {
    consentRequired,
    loginRequired,
    selectAccountRequired,
  });
  assertAuthorizeResponseType(authorizationRequest, client);
  assertAuthorizeScope(authorizationRequest, client);

  authorizationRequest = await authorizationRequestCache.create(authorizationRequest);

  setAuthorizationRequestCookie(ctx, authorizationRequest);

  if (authorizationRequest.status.selectAccount === SessionStatus.PENDING) {
    return { redirect: createSelectAccountPendingUri(authorizationRequest) };
  }

  if (authorizationRequest.status.login === SessionStatus.PENDING) {
    return { redirect: createLoginPendingUri(authorizationRequest) };
  }

  if (authorizationRequest.status.consent === SessionStatus.PENDING) {
    return { redirect: createConsentPendingUri(authorizationRequest) };
  }

  return { redirect: createAuthorizationVerifyUri(authorizationRequest) };
};
