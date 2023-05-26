import { TokenRequestBody, TokenResponse } from "@lindorm-io/common-types";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { AuthorizationCode } from "../../entity";
import { ServerKoaContext } from "../../types";
import { assertCodeChallenge } from "../../util";
import { generateTokenResponse } from "../oauth";

export const handleAuthorizationCodeGrant = async (
  ctx: ServerKoaContext<TokenRequestBody>,
): Promise<Partial<TokenResponse>> => {
  const {
    redis: { authorizationCodeCache, authorizationSessionCache },
    data: { code, codeVerifier, redirectUri },
    entity: { client },
    mongo: { browserSessionRepository, clientSessionRepository },
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
    id: authorizationCode.AuthorizationSessionId,
  });

  const { codeChallenge, codeChallengeMethod } = authorizationSession.code;

  if (!codeChallenge || !codeChallengeMethod) {
    throw new ServerError("Invalid Session", {
      code: "invalid_session",
      description: "Session data is missing",
      debug: { codeChallenge, codeChallengeMethod },
    });
  }

  if (!codeVerifier) {
    throw new ClientError("Invalid Request", {
      code: "invalid_request",
      data: { codeVerifier },
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

  if (!authorizationSession.browserSessionId) {
    throw new ServerError("Invalid Session", {
      code: "invalid_session",
      description: "Session data is missing",
      data: { browserSessionId: authorizationSession.browserSessionId },
    });
  }

  const browserSession = await browserSessionRepository.find({
    id: authorizationSession.browserSessionId,
  });

  if (
    !browserSession.identityId ||
    !browserSession.levelOfAssurance ||
    !browserSession.methods.length
  ) {
    throw new ClientError("Invalid Request", {
      code: "invalid_request",
      description: "Authentication Required",
      debug: {
        identityId: browserSession.identityId,
        levelOfAssurance: browserSession.levelOfAssurance,
        methods: browserSession.methods,
      },
    });
  }

  await authorizationCodeCache.destroy(authorizationCode);
  await authorizationSessionCache.destroy(authorizationSession);

  if (!authorizationSession.clientSessionId) {
    throw new ServerError("Invalid Session", {
      code: "invalid_session",
      data: { clientSessionId: authorizationSession.clientSessionId },
    });
  }

  const clientSession = await clientSessionRepository.find({
    id: authorizationSession.clientSessionId,
  });

  return await generateTokenResponse(ctx, client, clientSession);
};
