import Joi from "joi";
import { AuthorizationSession } from "../../entity";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_COUNTRY_CODE, JOI_JWT, JOI_NONCE, JOI_STATE } from "../../common";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";
import { expiryDate } from "@lindorm-io/expiry";
import { removeEmptyFromArray, uniqArray } from "@lindorm-io/core";
import {
  setAuthorizationSessionCookie,
  tryFindAccessSession,
  tryFindBrowserSessions,
  tryFindRefreshSession,
} from "../../handler";
import {
  JOI_DISPLAY_MODE,
  JOI_PKCE_METHOD,
  JOI_PROMPT_REGEX,
  JOI_RESPONSE_MODE,
  JOI_RESPONSE_TYPE_REGEX,
} from "../../constant";
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
  isConsentRequired,
  isLoginRequired,
  isSelectAccountRequired,
} from "../../util";
import {
  AuthorizeRequestQuery,
  OauthPromptMode,
  OauthResponseType,
  SessionStatuses,
} from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";

type RequestData = AuthorizeRequestQuery;

export const oauthAuthorizeSchema = Joi.object<RequestData>()
  .keys({
    acrValues: Joi.string(),
    amrValues: Joi.string(),
    authToken: JOI_JWT,
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
  .required();

export const oauthAuthorizeController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { authorizationSessionCache },
    data: {
      acrValues,
      amrValues,
      authToken,
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

  const prompts = prompt ? (prompt.toLowerCase().split(" ") as Array<OauthPromptMode>) : [];
  const responseTypes = responseType.toLowerCase().split(" ") as Array<OauthResponseType>;
  const scopes = scope.toLowerCase().split(" ");

  assertRedirectUri(client, redirectUri);

  const expires = expiryDate(configuration.defaults.expiry.authorization_session);

  const { levelOfAssurance: requiredLevel, methods: requiredMethods } = filterAcrValues({
    acrValues,
    amrValues,
  });

  const { levelOfAssurance: recommendedLevel, methods: recommendedMethods } = filterAcrValues({
    acrArray: idToken?.authContextClass,
    amrArray: idToken?.authMethodsReference,
  });

  const browserSessions = await tryFindBrowserSessions(ctx, idToken);
  const browserSession = browserSessions.length === 1 ? browserSessions[0] : undefined;

  const accessSession = await tryFindAccessSession(ctx, client, browserSession);
  const refreshSession = await tryFindRefreshSession(ctx, client, browserSession, idToken);

  const audiences = idToken
    ? uniqArray(idToken.audiences, client.id, client.defaults.audiences)
    : uniqArray(client.id, client.defaults.audiences);

  let authorizationSession: AuthorizationSession = new AuthorizationSession({
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
      requiredLevel,
      requiredMethods,
    },
    requestedSelectAccount: {
      browserSessions: browserSessions.map((x) => ({
        browserSessionId: x.id,
        identityId: x.identityId,
      })),
    },

    authToken,
    browserSessionId: browserSession?.id || null,
    clientId: client.id,
    accessSessionId: accessSession?.id || null,
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
    refreshSessionId: refreshSession?.id || null,
    responseMode: responseMode || client.defaults.responseMode,
    responseTypes,
    state,
    uiLocales: uiLocales ? uiLocales.split(" ") : [],
  });

  const selectAccountRequired = isSelectAccountRequired(authorizationSession);

  authorizationSession.status.selectAccount = selectAccountRequired
    ? SessionStatuses.PENDING
    : SessionStatuses.SKIP;

  const loginRequired = isLoginRequired(
    authorizationSession,
    browserSession,
    accessSession,
    refreshSession,
  );

  authorizationSession.status.login = loginRequired
    ? SessionStatuses.PENDING
    : SessionStatuses.SKIP;

  const consentRequired = isConsentRequired(
    authorizationSession,
    browserSession,
    accessSession,
    refreshSession,
  );

  authorizationSession.status.consent = consentRequired
    ? SessionStatuses.PENDING
    : SessionStatuses.SKIP;

  assertAuthorizePrompt(authorizationSession, {
    consentRequired,
    loginRequired,
    selectAccountRequired,
  });
  assertAuthorizeResponseType(authorizationSession, client);
  assertAuthorizeScope(authorizationSession, client);

  authorizationSession = await authorizationSessionCache.create(authorizationSession);

  setAuthorizationSessionCookie(ctx, authorizationSession);

  if (authorizationSession.status.selectAccount === SessionStatuses.PENDING) {
    return { redirect: createSelectAccountPendingUri(authorizationSession) };
  }

  if (authorizationSession.status.login === SessionStatuses.PENDING) {
    return { redirect: createLoginPendingUri(authorizationSession) };
  }

  if (authorizationSession.status.consent === SessionStatuses.PENDING) {
    return { redirect: createConsentPendingUri(authorizationSession) };
  }

  return { redirect: createAuthorizationVerifyUri(authorizationSession) };
};
