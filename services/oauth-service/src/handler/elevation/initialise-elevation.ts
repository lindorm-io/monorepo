import {
  AuthenticationMethod,
  LevelOfAssurance,
  OpenIdDisplayMode,
} from "@lindorm-io/common-types";
import { removeEmptyFromArray, uniqArray } from "@lindorm-io/core";
import { ClientError } from "@lindorm-io/errors";
import { expiryDate } from "@lindorm-io/expiry";
import { ElevationRequest } from "../../entity";
import { configuration } from "../../server/configuration";
import { ServerKoaContext } from "../../types";
import { getAdjustedAccessLevel } from "../../util";

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
): Promise<ElevationRequest> => {
  const {
    redis: { elevationRequestCache },
    entity: { client, clientSession },
    mongo: { browserSessionRepository },
    token: { idToken },
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

  if (idToken && idToken.session !== clientSession.id) {
    throw new ClientError("Invalid request", {
      description: "Id token mismatch",
    });
  }

  const browserSession = await browserSessionRepository.find({
    id: clientSession.browserSessionId,
  });

  const adjustedAccessLevel = getAdjustedAccessLevel(clientSession);

  return await elevationRequestCache.create(
    new ElevationRequest({
      requestedAuthentication: {
        minimumLevel: (clientSession.levelOfAssurance - adjustedAccessLevel) as LevelOfAssurance,
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

      browserSessionId: browserSession.id,
      clientId: client.id,
      clientSessionId: clientSession.id,
      country,
      displayMode: display,
      expires: expiryDate(configuration.defaults.expiry.elevation_session),
      idTokenHint: idToken?.token,
      identityId: clientSession.identityId,
      nonce: nonce || idToken?.nonce || undefined,
      redirectUri,
      state,
      uiLocales,
    }),
  );
};
