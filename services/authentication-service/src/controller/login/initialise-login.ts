import Joi from "joi";
import { AuthenticationMethod } from "../../enum";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, LevelOfAssurance, SessionStatus, TokenType } from "../../common";
import { LOGIN_SESSION_COOKIE_NAME, REGEX_EMAIL, REGEX_PHONE } from "../../constant";
import { LoginSession } from "../../entity";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";
import { createHash, randomUUID } from "crypto";
import { createURL, randomString, PKCEMethod } from "@lindorm-io/core";
import {
  confirmOauthAuthenticationSession,
  fetchOauthAuthenticationInfo,
  handleAuthenticationInitialisation,
  skipOauthAuthenticationSession,
} from "../../handler";

interface RequestData {
  sessionId: string;
}

export const initialiseLoginSchema = Joi.object<RequestData>({
  sessionId: JOI_GUID.required(),
});

export const initialiseLoginController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { loginSessionCache },
    data: { sessionId },
    jwt,
  } = ctx;

  const {
    authenticationRequired,
    authenticationStatus,
    authorizationSession: { displayMode, expiresAt, identityId, loginHint, uiLocales },
    requested: { authToken, authenticationMethods, country, levelOfAssurance },
  } = await fetchOauthAuthenticationInfo(ctx, sessionId);

  if (!authenticationRequired) {
    const { redirectTo } = await skipOauthAuthenticationSession(ctx, sessionId);

    return { redirect: redirectTo };
  }

  if (authenticationStatus !== SessionStatus.PENDING) {
    throw new ClientError("Invalid Session Status");
  }

  if (authToken) {
    try {
      const authenticationConfirmationToken = jwt.verify(authToken, {
        issuer: configuration.server.issuer,
        subject: identityId,
        types: [TokenType.AUTHENTICATION_CONFIRMATION],
      });

      const { redirectTo } = await confirmOauthAuthenticationSession(ctx, sessionId, {
        acrValues: authenticationConfirmationToken.authContextClass,
        amrValues: authenticationConfirmationToken.authMethodsReference,
        identityId: authenticationConfirmationToken.subject,
        levelOfAssurance: authenticationConfirmationToken.levelOfAssurance as LevelOfAssurance,
        remember: authenticationConfirmationToken.claims.remember,
      });

      return { redirect: redirectTo };
    } catch (err) {
      /* ignored */
    }
  }

  const emailHint = loginHint?.find((item) => REGEX_EMAIL.test(item));
  const phoneHint = loginHint?.find((item) => REGEX_PHONE.test(item));

  const codeVerifier = randomString(32);
  const codeChallengeMethod = PKCEMethod.S256;
  const codeChallenge = createHash("sha256").update(codeVerifier, "utf8").digest("base64");

  const authenticationSessionId = randomUUID();
  const loginSessionId = randomUUID();

  await handleAuthenticationInitialisation(ctx, {
    id: authenticationSessionId,
    clientId: configuration.oauth.client_id,
    codeChallenge,
    codeChallengeMethod,
    country,
    emailHint,
    expires: new Date(expiresAt),
    identityId,
    loginSessionId,
    nonce: randomString(16),
    phoneHint,
    redirectUri: createURL("/sessions/login/confirm", {
      host: configuration.server.host,
      port: configuration.server.port,
    }).toString(),
    requestedLevelOfAssurance: levelOfAssurance,
    requestedMethods: authenticationMethods.filter((key: AuthenticationMethod) =>
      Object.values(AuthenticationMethod).includes(key),
    ) as Array<AuthenticationMethod>,
  });

  const loginSession = await loginSessionCache.create(
    new LoginSession({
      id: loginSessionId,
      authenticationSessionId,
      codeVerifier,
      expires: new Date(expiresAt),
      oauthSessionId: sessionId,
    }),
  );

  ctx.setCookie(LOGIN_SESSION_COOKIE_NAME, loginSession.id, { expiry: loginSession.expires });

  return {
    redirect: createURL(configuration.frontend.routes.login, {
      host: configuration.frontend.host,
      port: configuration.frontend.port,
      query: {
        displayMode,
        uiLocales,
      },
    }),
  };
};
