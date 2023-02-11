import { AuthorizationCode, RefreshSession } from "../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { assertCodeChallenge } from "../../util";
import { configuration } from "../../server/configuration";
import { expiryDate } from "@lindorm-io/expiry";
import { flatten, uniq } from "lodash";
import { generateTokenResponse } from "./generate-token-response";
import { LindormScopes, TokenRequestBody, TokenResponse } from "@lindorm-io/common-types";

export const handleAuthorizationCodeGrant = async (
  ctx: ServerKoaContext<TokenRequestBody>,
): Promise<Partial<TokenResponse>> => {
  const {
    cache: { authorizationCodeCache, authorizationSessionCache },
    data: { code, codeVerifier, redirectUri },
    entity: { client },
    repository: { browserSessionRepository, consentSessionRepository, refreshSessionRepository },
  } = ctx;

  let authorizationCode: AuthorizationCode;

  try {
    authorizationCode = await authorizationCodeCache.find({ code });
  } catch (err: any) {
    throw new ClientError("Invalid Request", {
      code: "invalid_code",
      description: "Invalid Code",
      error: err,
    });
  }

  const authorizationSession = await authorizationSessionCache.find({
    id: authorizationCode.authorizationSessionId,
  });

  const { codeChallenge, codeChallengeMethod } = authorizationSession.code;

  if (!codeChallenge || !codeChallengeMethod) {
    throw new ServerError("Invalid Session", {
      code: "invalid_session",
      description: "Session data is missing",
      data: { codeChallenge, codeChallengeMethod },
    });
  }

  assertCodeChallenge(codeChallenge, codeChallengeMethod, codeVerifier);

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

  if (!authorizationSession.identifiers.browserSessionId) {
    throw new ServerError("Invalid Session", {
      code: "invalid_session",
      description: "Session data is missing",
      data: { browserSessionId: authorizationSession.identifiers.browserSessionId },
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

  if (!authorizationSession.identifiers.consentSessionId) {
    throw new ServerError("Invalid Session", {
      code: "invalid_session",
      description: "Session data is missing",
      data: { consentSessionId: authorizationSession.identifiers.consentSessionId },
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

  if (authorizationSession.requestedConsent.scopes.includes(LindormScopes.OFFLINE_ACCESS)) {
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
