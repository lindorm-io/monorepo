import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ElevationSession } from "../../../entity";
import {
  AuthenticationMethod,
  JOI_COUNTRY_CODE,
  JOI_GUID,
  JOI_JWT,
  JOI_LEVEL_OF_ASSURANCE,
  JOI_LOCALE,
  JOI_NONCE,
  JOI_STATE,
} from "../../../common";
import { LevelOfAssurance } from "@lindorm-io/jwt";
import { ServerKoaController } from "../../../types";
import { SessionHint } from "../../../enum";
import { configuration } from "../../../server/configuration";
import { fromUnixTime } from "date-fns";
import { assertRedirectUri, getAdjustedAccessLevel } from "../../../util";
import { getExpiryDate, removeEmptyFromArray } from "@lindorm-io/core";
import { uniq } from "lodash";

type RequestData = {
  authenticationHint?: Array<string>;
  authenticationMethods?: Array<AuthenticationMethod>;
  clientId: string;
  country?: string;
  idTokenHint?: string;
  levelOfAssurance?: LevelOfAssurance;
  nonce?: string;
  redirectUri?: string;
  state?: string;
  uiLocales?: Array<string>;
};

type ReturnBody = {
  elevationSessionId: string;
};

export const elevateSchema = Joi.object<RequestData>()
  .keys({
    authenticationHint: Joi.array().items(Joi.string()).optional(),
    authenticationMethods: Joi.array().items(Joi.string()).optional(),
    clientId: JOI_GUID.required(),
    country: JOI_COUNTRY_CODE.optional(),
    idTokenHint: JOI_JWT.optional(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.optional(),
    nonce: JOI_NONCE.optional(),
    redirectUri: Joi.string().uri().optional(),
    state: JOI_STATE.optional(),
    uiLocales: Joi.array().items(JOI_LOCALE).optional(),
  })
  .options({ abortEarly: false })
  .required();

export const elevateController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ReturnBody> => {
  const {
    cache: { elevationSessionCache },
    data: {
      authenticationHint,
      authenticationMethods,
      country,
      levelOfAssurance,
      nonce,
      redirectUri,
      state,
      uiLocales,
    },
    entity: { client },
    token: { bearerToken, idToken },
  } = ctx;

  const expires = getExpiryDate(configuration.defaults.expiry.authorization_session);

  if (redirectUri) {
    assertRedirectUri(redirectUri, client);
  }

  const adjustedAccessLevel = getAdjustedAccessLevel({
    latestAuthentication: fromUnixTime(bearerToken.authTime),
    levelOfAssurance: bearerToken.levelOfAssurance,
  });

  const elevationSession = await elevationSessionCache.create(
    new ElevationSession({
      identifiers: {
        browserSessionId:
          bearerToken.sessionHint === SessionHint.BROWSER ? bearerToken.sessionId : null,
        refreshSessionId:
          bearerToken.sessionHint === SessionHint.REFRESH ? bearerToken.sessionId : null,
      },
      requestedAuthentication: {
        authenticationMethods,
        levelHint: idToken?.levelOfAssurance,
        levelOfAssurance,
        methodHint: idToken?.authMethodsReference as Array<AuthenticationMethod>,
        missingAccessLevel: (bearerToken.levelOfAssurance -
          adjustedAccessLevel) as LevelOfAssurance,
      },

      authenticationHint:
        authenticationHint ||
        removeEmptyFromArray(
          uniq([idToken?.claims?.email, idToken?.claims?.phoneNumber, idToken?.claims?.username]),
        ).sort(),
      clientId: client.id,
      country,
      expires,
      idTokenHint: idToken?.token,
      identityId: bearerToken.subject,
      nonce: nonce || idToken?.nonce,
      redirectUri,
      state,
      uiLocales,
    }),
  );

  return { body: { elevationSessionId: elevationSession.id } };
};
