import { ClientError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { OAuthTokenRequestData, OAuthTokenResponseBody } from "../../types";
import { AuthorizationCode, RefreshSession } from "../../entity";
import { Scope } from "../../common";
import { assertCodeChallenge } from "../../util";
import { configuration } from "../../server/configuration";
import { flatten, uniq } from "lodash";
import { generateTokenResponse } from "./generate-token-response";
import { expiryDate } from "@lindorm-io/expiry";

export const handleAuthorizationCodeGrant = async (
  ctx: ServerKoaContext<OAuthTokenRequestData>,
): Promise<Partial<OAuthTokenResponseBody>> => {
  const {
    cache: { authorizationCodeCache, authorizationSessionCache },
    data: { code, codeVerifier, redirectUri },
    entity: { client },
    repository: { browserSessionRepository, consentSessionRepository, refreshSessionRepository },
  } = ctx;

  let authorizationCode: AuthorizationCode;

  try {
    authorizationCode = await authorizationCodeCache.find({ code });
  } catch (err) {
    throw new ClientError("Invalid Request", {
      code: "invalid_code",
      description: "Invalid Code",
      error: err,
    });
  }

  const authorizationSession = await authorizationSessionCache.find({
    id: authorizationCode.authorizationSessionId,
  });

  assertCodeChallenge(
    authorizationSession.code.codeChallenge,
    authorizationSession.code.codeChallengeMethod,
    codeVerifier,
  );

  if (authorizationSession.clientId !== client.id) {
    throw new ClientError("Invalid Request", {
      code: "invalid_request",
      description: "Invalid client ID",
    });
  }

  if (authorizationSession.redirectUri !== redirectUri) {
    throw new ClientError("Invalid Request", {
      code: "invalid_request",
      description: "Invalid redirect URI",
    });
  }

  const browserSession = await browserSessionRepository.find({
    id: authorizationSession.identifiers.browserSessionId,
  });

  if (
    !browserSession.acrValues.length ||
    !browserSession.amrValues.length ||
    !browserSession.identityId ||
    !browserSession.levelOfAssurance
  ) {
    throw new ClientError("Invalid Request", {
      code: "invalid_request",
      description: "Authentication Required",
      debug: {
        acrValues: browserSession.acrValues,
        amrValues: browserSession.amrValues,
        identityId: browserSession.identityId,
        levelOfAssurance: browserSession.levelOfAssurance,
      },
    });
  }

  const consentSession = await consentSessionRepository.find({
    id: authorizationSession.identifiers.consentSessionId,
  });

  if (
    !consentSession.audiences.length ||
    !consentSession.scopes.length ||
    !consentSession.sessions.includes(browserSession.id)
  ) {
    throw new ClientError("Invalid Request", {
      code: "invalid_request",
      description: "Consent Required",
      debug: {
        audiences: consentSession.audiences,
        scopes: consentSession.scopes,
      },
    });
  }

  await authorizationCodeCache.destroy(authorizationCode);
  await authorizationSessionCache.destroy(authorizationSession);

  if (authorizationSession.requestedConsent.scopes.includes(Scope.OFFLINE_ACCESS)) {
    const refreshSession = await refreshSessionRepository.create(
      new RefreshSession({
        acrValues: browserSession.acrValues,
        amrValues: browserSession.amrValues,
        clientId: client.id,
        expires: expiryDate(
          client.expiry.refreshToken || configuration.defaults.expiry.refresh_session,
        ),
        identityId: browserSession.identityId,
        levelOfAssurance: browserSession.levelOfAssurance,
        nonce: browserSession.nonce,
        previousRefreshSessionId: authorizationSession.identifiers.refreshSessionId,
        uiLocales: browserSession.uiLocales,
      }),
    );

    consentSession.sessions = uniq(flatten([consentSession.sessions, refreshSession.id])).sort();

    await consentSessionRepository.update(consentSession);

    return generateTokenResponse(ctx, client, refreshSession, consentSession);
  } else {
    browserSession.clients = uniq(flatten([browserSession.clients, client.id])).sort();

    await browserSessionRepository.update(browserSession);
  }

  return generateTokenResponse(ctx, client, browserSession, consentSession);
};
