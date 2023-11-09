import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  OpenIdDisplayMode,
} from "@lindorm-io/common-enums";
import { LevelOfAssurance } from "@lindorm-io/common-types";
import { removeEmptyFromArray, uniqArray } from "@lindorm-io/core";
import { ClientError } from "@lindorm-io/errors";
import { expiryDate } from "@lindorm-io/expiry";
import { ElevationSession } from "../../entity";
import { configuration } from "../../server/configuration";
import { ServerKoaContext } from "../../types";
import { getAdjustedAccessLevel } from "../../util";

type Options = {
  authenticationHint?: Array<string>;
  country?: string;
  display?: OpenIdDisplayMode;
  factors?: Array<AuthenticationFactor>;
  levelOfAssurance?: LevelOfAssurance;
  methods?: Array<AuthenticationMethod>;
  nonce?: string;
  redirectUri?: string;
  state?: string;
  strategies?: Array<AuthenticationStrategy>;
  uiLocales?: Array<string>;
};

export const initialiseElevation = async (
  ctx: ServerKoaContext,
  options: Options,
): Promise<ElevationSession> => {
  const {
    redis: { elevationSessionCache },
    entity: { client, clientSession },
    mongo: { browserSessionRepository },
    token: { idToken },
  } = ctx;

  const {
    authenticationHint,
    country,
    display,
    factors,
    levelOfAssurance,
    methods,
    nonce,
    redirectUri,
    state,
    strategies,
    uiLocales,
  } = options;

  if (idToken && idToken.metadata.session !== clientSession.id) {
    throw new ClientError("Invalid request", {
      description: "Id token mismatch",
    });
  }

  const browserSession = clientSession.browserSessionId
    ? await browserSessionRepository.find({
        id: clientSession.browserSessionId,
      })
    : undefined;

  const adjustedAccessLevel = getAdjustedAccessLevel(clientSession);
  const calculatedMinimumLoa = clientSession.levelOfAssurance - adjustedAccessLevel;
  const minimumLevelOfAssurance = (
    calculatedMinimumLoa > 0 ? calculatedMinimumLoa : 1
  ) as LevelOfAssurance;

  return await elevationSessionCache.create(
    new ElevationSession({
      requestedAuthentication: {
        factors: factors || [],
        methods: methods || [],
        minimumLevelOfAssurance,
        levelOfAssurance: levelOfAssurance || 0,
        strategies: strategies || [],
      },
      authenticationHint: removeEmptyFromArray(
        uniqArray(
          authenticationHint,
          idToken?.claims?.email,
          idToken?.claims?.phoneNumber,
          idToken?.claims?.username,
        ),
      ),
      browserSessionId: browserSession?.id,
      clientId: client.id,
      clientSessionId: clientSession.id,
      country,
      displayMode: display,
      expires: expiryDate(configuration.defaults.expiry.elevation_session),
      idTokenHint: idToken?.token,
      identityId: clientSession.identityId,
      nonce: nonce || idToken?.metadata.nonce || undefined,
      redirectUri,
      state,
      uiLocales,
    }),
  );
};
