import Joi from "joi";
import { AuthorizationSession } from "../../entity";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_COUNTRY_CODE, JOI_JWT, JOI_NONCE, JOI_STATE } from "../../common";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";
import { expiryDate } from "@lindorm-io/expiry";
import { flatten, uniq } from "lodash";
import { removeEmptyFromArray } from "@lindorm-io/core";
import { tryFindBrowserSession, tryFindConsentSession, tryFindRefreshSession } from "../../handler";
import {
  AUTHORIZATION_SESSION_COOKIE_NAME,
  JOI_DISPLAY_MODE,
  JOI_PKCE_METHOD,
  JOI_PROMPT_REGEX,
  JOI_RESPONSE_MODE,
  JOI_RESPONSE_TYPE_REGEX,
} from "../../constant";
import {
  assertAuthorizePrompt,
  assertRedirectUri,
  assertAuthorizeResponseType,
  assertAuthorizeScope,
  createAuthorizationVerifyUri,
  createLoginPendingUri,
  filterAcrValues,
  isLoginRequired,
  isConsentRequired,
} from "../../util";
import {
  AuthorizeRequestQuery,
  Environments,
  OauthPromptMode,
  OauthResponseType,
  SessionStatuses,
} from "@lindorm-io/common-types";

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

  const prompts = prompt ? (prompt.toLowerCase().split(" ") as Array<OauthPromptMode>) : [];
  const responseTypes = responseType.toLowerCase().split(" ") as Array<OauthResponseType>;
  const scopes = scope.toLowerCase().split(" ");

  assertRedirectUri(redirectUri, client);

  const expires = expiryDate(configuration.defaults.expiry.authorization_session);

  const { levelOfAssurance: requiredLevel, methods: requiredMethods } = filterAcrValues({
    acrValues,
    amrValues,
  });

  const { levelOfAssurance: recommendedLevel, methods: recommendedMethods } = filterAcrValues({
    acrArray: idToken?.authContextClass,
    amrArray: idToken?.authMethodsReference,
  });

  const browserSession = await tryFindBrowserSession(ctx);
  const consentSession = await tryFindConsentSession(ctx, client, browserSession);
  const refreshSession = await tryFindRefreshSession(ctx, idToken);

  const audiences = idToken
    ? uniq(flatten([idToken.audiences, client.id, client.defaults.audiences])).sort()
    : uniq(flatten([client.id, client.defaults.audiences])).sort();

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
    identifiers: {
      browserSessionId: browserSession?.id || null,
      consentSessionId: consentSession?.id || null,
      refreshSessionId: refreshSession?.id || null,
    },
    authToken,
    clientId: client.id,
    country,
    displayMode: display || client.defaults.displayMode,
    expires,
    idTokenHint: idToken ? idToken.token : null,
    loginHint: removeEmptyFromArray(
      uniq([
        loginHint,
        idToken?.claims?.email,
        idToken?.claims?.phoneNumber,
        idToken?.claims?.username,
      ]),
    ).sort(),
    maxAge: maxAge ? parseInt(maxAge, 10) : null,
    nonce: nonce || idToken?.nonce || browserSession?.nonce,
    originalUri: new URL(ctx.request.originalUrl, configuration.server.host).toString(),
    promptModes: prompts,
    redirectData,
    redirectUri,
    responseMode: responseMode || client.defaults.responseMode,
    responseTypes,
    state,
    uiLocales: uiLocales ? uiLocales.split(" ") : [],
  });

  const loginRequired = isLoginRequired(authorizationSession, browserSession);
  if (!loginRequired) {
    authorizationSession.status.login = SessionStatuses.SKIP;
  }

  const consentRequired = isConsentRequired(authorizationSession, browserSession, consentSession);
  if (!consentRequired) {
    authorizationSession.status.consent = SessionStatuses.SKIP;
  }

  assertAuthorizePrompt(authorizationSession, { consentRequired, loginRequired });
  assertAuthorizeResponseType(authorizationSession, client);
  assertAuthorizeScope(authorizationSession, client);

  authorizationSession = await authorizationSessionCache.create(authorizationSession);

  ctx.cookies.set(AUTHORIZATION_SESSION_COOKIE_NAME, authorizationSession.id, {
    expires: authorizationSession.expires,
    httpOnly: true,
    overwrite: true,
    signed: ctx.server.environment !== Environments.TEST,
  });

  if (!loginRequired) {
    return { redirect: createAuthorizationVerifyUri(authorizationSession) };
  }

  return { redirect: createLoginPendingUri(authorizationSession) };
};
