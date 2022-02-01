import { ClientError } from "@lindorm-io/errors";
import { Context } from "../../types";
import { OAuthTokenRequestData, OAuthTokenResponseBody } from "../../types";
import { RefreshSession } from "../../entity";
import { Scope } from "../../common";
import { assertCodeChallenge } from "../../util";
import { configuration } from "../../configuration";
import { flatten, includes, uniq } from "lodash";
import { generateTokenResponse } from "./generate-token-response";
import { getExpiryDate } from "@lindorm-io/core";

export const handleAuthorizationCodeGrant = async (
  ctx: Context<OAuthTokenRequestData>,
): Promise<Partial<OAuthTokenResponseBody>> => {
  const {
    cache: { authorizationSessionCache },
    data: { code, codeVerifier, redirectUri },
    entity: { client },
    repository: { browserSessionRepository, consentSessionRepository, refreshSessionRepository },
  } = ctx;

  const authorizationSession = await authorizationSessionCache.find({
    code,
  });

  assertCodeChallenge(
    authorizationSession.codeChallenge,
    authorizationSession.codeChallengeMethod,
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
    id: authorizationSession.browserSessionId,
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
    id: authorizationSession.consentSessionId,
  });

  if (
    !consentSession.audiences.length ||
    !consentSession.scopes.length ||
    !includes(consentSession.sessions, browserSession.id)
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

  await authorizationSessionCache.destroy(authorizationSession);

  if (includes(authorizationSession.scopes, Scope.OFFLINE_ACCESS)) {
    const refreshSession = await refreshSessionRepository.create(
      new RefreshSession({
        acrValues: browserSession.acrValues,
        amrValues: browserSession.amrValues,
        clientId: client.id,
        expires: getExpiryDate(client.expiry.refreshToken || configuration.expiry.refresh_session),
        identityId: browserSession.identityId,
        levelOfAssurance: browserSession.levelOfAssurance,
        nonce: browserSession.nonce,
        uiLocales: browserSession.uiLocales,
      }),
    );

    consentSession.sessions = uniq(flatten([consentSession.sessions, refreshSession.id]));

    await consentSessionRepository.update(consentSession);

    return generateTokenResponse(ctx, client, refreshSession, consentSession.scopes);
  } else {
    browserSession.clients = uniq(flatten([browserSession.clients, client.id]));

    await browserSessionRepository.update(browserSession);
  }

  return generateTokenResponse(ctx, client, browserSession, consentSession.scopes);
};
