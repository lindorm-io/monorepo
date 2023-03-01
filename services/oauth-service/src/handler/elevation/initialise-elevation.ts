import {
  AuthenticationMethod,
  LevelOfAssurance,
  OpenIdDisplayMode,
} from "@lindorm-io/common-types";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ElevationSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { SessionHint } from "../../enum";
import { configuration } from "../../server/configuration";
import { expiryDate } from "@lindorm-io/expiry";
import { fromUnixTime } from "date-fns";
import { getAdjustedAccessLevel } from "../../util";
import { getBrowserSessionCookies } from "../cookies";
import { removeEmptyFromArray, uniqArray } from "@lindorm-io/core";

type Options = {
  authenticationHint?: Array<string>;
  country?: string;
  display?: OpenIdDisplayMode;
  levelOfAssurance?: LevelOfAssurance;
  methods?: Array<AuthenticationMethod>;
  nonce?: string;
  redirectUri?: string;
  state?: string;
  uiLocales?: Array<string>;
};

export const initialiseElevation = async (
  ctx: ServerKoaContext,
  options: Options,
): Promise<ElevationSession> => {
  const {
    cache: { elevationSessionCache },
    entity: { client },
    repository: { accessSessionRepository, browserSessionRepository, refreshSessionRepository },
    token: { bearerToken, idToken },
  } = ctx;

  const {
    authenticationHint,
    country,
    display,
    levelOfAssurance,
    methods,
    nonce,
    redirectUri,
    state,
    uiLocales,
  } = options;

  if (!bearerToken.authTime) {
    throw new ServerError("Invalid request", {
      code: "invalid_request",
      description: "Token claim is missing",
      data: { authTime: bearerToken.authTime },
    });
  }

  if (!bearerToken.session) {
    throw new ServerError("Invalid request", {
      code: "invalid_request",
      description: "Token claim is missing",
      data: { authTime: bearerToken.authTime },
    });
  }

  if (idToken && idToken.session !== bearerToken.session) {
    throw new ClientError("Invalid request", {
      code: "invalid_request",
      description: "Invalid session identifier",
      debug: {
        expect: bearerToken.session,
        actual: idToken.session,
      },
    });
  }

  if (idToken && idToken.client !== client.id) {
    throw new ClientError("Invalid request", {
      code: "invalid_request",
      description: "Invalid client identifier",
      debug: {
        expect: client.id,
        actual: idToken.client,
      },
    });
  }

  const adjustedAccessLevel = getAdjustedAccessLevel({
    latestAuthentication: fromUnixTime(bearerToken.authTime),
    levelOfAssurance: bearerToken.levelOfAssurance,
  });

  const refreshSession =
    bearerToken.sessionHint === SessionHint.REFRESH
      ? await refreshSessionRepository.find({ id: bearerToken.session })
      : undefined;

  const accessSession =
    bearerToken.sessionHint === SessionHint.ACCESS
      ? await accessSessionRepository.find({ id: bearerToken.session })
      : undefined;

  const browserSessions = getBrowserSessionCookies(ctx);

  const browserSessionId = accessSession?.browserSessionId
    ? browserSessions.find((id) => id === accessSession?.browserSessionId)
    : undefined;

  const browserSession = browserSessionId
    ? await browserSessionRepository.find({
        id: browserSessionId,
      })
    : undefined;

  if (accessSession && !browserSession) {
    throw new ClientError("Session not found", {
      debug: { browserSessionId },
    });
  }

  return await elevationSessionCache.create(
    new ElevationSession({
      requestedAuthentication: {
        minimumLevel: (bearerToken.levelOfAssurance - adjustedAccessLevel) as LevelOfAssurance,
        recommendedLevel: idToken?.levelOfAssurance || 0,
        recommendedMethods: idToken?.authMethodsReference as Array<AuthenticationMethod>,
        requiredLevel: levelOfAssurance || 0,
        requiredMethods: methods || [],
      },
      authenticationHint: removeEmptyFromArray(
        uniqArray(
          authenticationHint,
          idToken?.claims?.email,
          idToken?.claims?.phoneNumber,
          idToken?.claims?.username,
        ),
      ),

      accessSessionId: accessSession?.id,
      browserSessionId: browserSession?.id,
      clientId: client.id,
      country,
      displayMode: display,
      expires: expiryDate(configuration.defaults.expiry.authorization_session),
      idTokenHint: idToken?.token,
      identityId: bearerToken.subject,
      nonce: nonce || idToken?.nonce || undefined,
      redirectUri,
      refreshSessionId: refreshSession?.id,
      state,
      uiLocales,
    }),
  );
};
