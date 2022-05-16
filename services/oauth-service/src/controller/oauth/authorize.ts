import Joi from "joi";
import { AuthorizationSession } from "../../entity";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { configuration } from "../../server/configuration";
import { createURL, getExpires, PKCEMethod } from "@lindorm-io/core";
import { setAuthorizationSessionCookie, tryFindConsentSession } from "../../handler";
import { uniq } from "lodash";
import {
  DisplayMode,
  JOI_COUNTRY_CODE,
  JOI_GUID,
  JOI_NONCE,
  PromptMode,
  ResponseMode,
  ResponseType,
} from "../../common";
import {
  JOI_DISPLAY_MODE,
  JOI_PKCE_METHOD,
  JOI_PROMPT_REGEX,
  JOI_RESPONSE_MODE,
  JOI_RESPONSE_TYPE_REGEX,
} from "../../constant";
import {
  assertAuthorizePrompt,
  assertAuthorizeRedirectUri,
  assertAuthorizeResponseType,
  assertAuthorizeScope,
  filterAcrValues,
  isAuthenticationRequired,
  isConsentRequired,
} from "../../util";

interface RequestData {
  acrValues?: string;
  authenticationId?: string; // lindorm.io
  clientId: string;
  codeChallenge?: string;
  codeChallengeMethod?: PKCEMethod;
  country?: string; // lindorm.io
  display?: DisplayMode;
  idTokenHint?: string;
  loginHint?: string;
  maxAge?: string;
  nonce?: string;
  pkceVerifier?: string; // lindorm.io
  prompt?: string;
  redirectData?: string;
  redirectUri: string;
  responseMode?: ResponseMode;
  responseType: string;
  scope: string;
  state: string;
  uiLocales?: string;
}

export const oauthAuthorizeSchema = Joi.object<RequestData>({
  acrValues: Joi.string().optional(),
  authenticationId: JOI_GUID.optional(),
  clientId: JOI_GUID.required(),
  codeChallenge: Joi.string().optional(),
  codeChallengeMethod: JOI_PKCE_METHOD.optional(),
  country: JOI_COUNTRY_CODE.optional(),
  display: JOI_DISPLAY_MODE.optional(),
  idTokenHint: Joi.string().optional(),
  loginHint: Joi.string().optional(),
  maxAge: Joi.string()
    .pattern(/^[0-9]+$/)
    .optional(),
  nonce: JOI_NONCE.optional(),
  pkceVerifier: Joi.string().optional(),
  prompt: JOI_PROMPT_REGEX.optional(),
  redirectData: Joi.string().base64().optional(),
  redirectUri: Joi.string().uri().required(),
  responseMode: JOI_RESPONSE_MODE.optional(),
  responseType: JOI_RESPONSE_TYPE_REGEX.required(),
  scope: Joi.string().required(),
  state: Joi.string().required(),
  uiLocales: Joi.string().optional(),
});

export const oauthAuthorizeController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { authorizationSessionCache },
    data: {
      acrValues,
      authenticationId,
      codeChallenge,
      codeChallengeMethod,
      country,
      display,
      loginHint,
      maxAge,
      nonce,
      pkceVerifier,
      prompt,
      redirectData,
      redirectUri,
      responseMode,
      responseType,
      scope,
      state,
      uiLocales,
    },
    entity: { browserSession, client },
    token: { idToken },
  } = ctx;

  const prompts = prompt ? (prompt.toLowerCase().split(" ") as Array<PromptMode>) : [];
  const responseTypes = responseType.toLowerCase().split(" ") as Array<ResponseType>;
  const scopes = scope.toLowerCase().split(" ");

  const { expires, expiresIn } = getExpires(configuration.expiry.authorization_session);

  const { authenticationMethods, levelOfAssurance } = filterAcrValues(
    acrValues,
    idToken?.authContextClass,
    idToken?.authMethodsReference,
  );

  const consentSession = await tryFindConsentSession(ctx, browserSession, client);

  let authorizationSession: AuthorizationSession = new AuthorizationSession({
    audiences: idToken ? idToken.audiences : [client.id],
    authenticationId,
    authenticationMethods,
    browserSessionId: browserSession.id,
    clientId: client.id,
    codeChallenge,
    codeChallengeMethod,
    consentSessionId: consentSession?.id,
    country,
    displayMode: display || client.defaults.displayMode,
    expires,
    idTokenHint: idToken ? idToken.token : null,
    identityId: idToken ? idToken.subject : null,
    levelOfAssurance: levelOfAssurance || client.defaults.levelOfAssurance,
    loginHint: uniq([
      ...(loginHint ? [loginHint] : []),
      ...(idToken?.claims?.email ? [idToken.claims.email] : []),
      ...(idToken?.claims?.phoneNumber ? [idToken.claims.phoneNumber] : []),
      ...(idToken?.claims?.username ? [idToken.claims.username] : []),
    ]),
    maxAge: maxAge ? parseInt(maxAge, 10) : null,
    nonce: nonce || idToken?.nonce || browserSession.nonce,
    originalUri: new URL(ctx.request.originalUrl, configuration.server.host).toString(),
    pkceVerifier,
    promptModes: prompts,
    redirectData,
    redirectUri,
    responseMode: responseMode || client.defaults.responseMode,
    responseTypes,
    scopes,
    state,
    uiLocales: uiLocales ? uiLocales.split(" ") : null,
  });

  const authenticationRequired = isAuthenticationRequired(authorizationSession, browserSession);

  const consentRequired = isConsentRequired(authorizationSession, browserSession, consentSession);

  assertAuthorizePrompt(authorizationSession, {
    isConsentRequired: consentRequired,
    isAuthenticationRequired: authenticationRequired,
  });

  assertAuthorizeRedirectUri(authorizationSession, client);

  assertAuthorizeResponseType(authorizationSession, client);

  assertAuthorizeScope(authorizationSession, client);

  authorizationSession = await authorizationSessionCache.create(authorizationSession, expiresIn);

  setAuthorizationSessionCookie(ctx, authorizationSession);

  return {
    redirect: createURL(configuration.redirect.login, {
      host: configuration.services.authentication_service.host,
      port: configuration.services.authentication_service.port,
      query: {
        sessionId: authorizationSession.id,
      },
    }),
  };
};
