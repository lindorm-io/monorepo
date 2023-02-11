import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ElevationSession } from "../../../entity";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaController } from "../../../types";
import { SessionHint } from "../../../enum";
import { assertRedirectUri, getAdjustedAccessLevel } from "../../../util";
import { configuration } from "../../../server/configuration";
import { expiryDate } from "@lindorm-io/expiry";
import { fromUnixTime } from "date-fns";
import { removeEmptyFromArray } from "@lindorm-io/core";
import { uniq } from "lodash";
import {
  AuthenticationMethod,
  InitialiseElevateRequestBody,
  InitialiseElevateResponse,
  LevelOfAssurance,
} from "@lindorm-io/common-types";
import {
  JOI_COUNTRY_CODE,
  JOI_JWT,
  JOI_LEVEL_OF_ASSURANCE,
  JOI_LOCALE,
  JOI_NONCE,
  JOI_STATE,
} from "../../../common";

type RequestData = InitialiseElevateRequestBody;

type ResponseBody = InitialiseElevateResponse;

export const elevateSchema = Joi.object<RequestData>()
  .keys({
    acrValue: JOI_LEVEL_OF_ASSURANCE,
    amrValues: Joi.array().items(Joi.string()),
    authenticationHint: Joi.array().items(Joi.string()),
    clientId: Joi.string().guid().required(),
    country: JOI_COUNTRY_CODE,
    idTokenHint: JOI_JWT,
    nonce: JOI_NONCE,
    redirectUri: Joi.string().uri(),
    state: JOI_STATE,
    uiLocales: Joi.array().items(JOI_LOCALE),
  })
  .options({ abortEarly: false })
  .required();

export const elevateController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { elevationSessionCache },
    data: {
      acrValue,
      amrValues,
      authenticationHint,
      country,
      nonce,
      redirectUri,
      state,
      uiLocales,
    },
    entity: { client },
    token: { bearerToken, idToken },
  } = ctx;

  const expires = expiryDate(configuration.defaults.expiry.authorization_session);

  if (redirectUri) {
    assertRedirectUri(redirectUri, client);
  }

  if (!bearerToken.authTime) {
    throw new ServerError("Invalid Token", {
      code: "invalid_token",
      description: "Token claim is missing",
      data: { authTime: bearerToken.authTime },
    });
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
        minimumLevel: (bearerToken.levelOfAssurance - adjustedAccessLevel) as LevelOfAssurance,
        recommendedLevel: idToken?.levelOfAssurance,
        recommendedMethods: idToken?.authMethodsReference as Array<AuthenticationMethod>,
        requiredLevel: acrValue || 0,
        requiredMethods: amrValues || [],
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
