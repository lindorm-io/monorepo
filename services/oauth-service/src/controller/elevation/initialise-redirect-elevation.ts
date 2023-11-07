import { InitialiseElevationSessionRequestQuery } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { JOI_COUNTRY_CODE, JOI_JWT, JOI_NONCE, JOI_STATE } from "../../common";
import { JOI_DISPLAY_MODE } from "../../constant";
import { initialiseElevation } from "../../handler";
import { ServerKoaController } from "../../types";
import { assertRedirectUri, createElevationPendingUri, extractAcrValues } from "../../util";

type RequestData = InitialiseElevationSessionRequestQuery;

export const initialiseRedirectElevationSchema = Joi.object<RequestData>()
  .keys({
    acrValues: Joi.string(),
    authenticationHint: Joi.array().items(Joi.string()),
    clientId: Joi.string().guid().required(),
    country: JOI_COUNTRY_CODE,
    display: JOI_DISPLAY_MODE,
    idTokenHint: JOI_JWT,
    nonce: JOI_NONCE,
    redirectUri: Joi.string().uri().required(),
    state: JOI_STATE.required(),
    uiLocales: Joi.string(),
  })
  .options({ abortEarly: false })
  .required();

export const initialiseRedirectElevationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { acrValues, authenticationHint, country, display, nonce, redirectUri, state, uiLocales },
    entity: { client },
  } = ctx;

  assertRedirectUri(client, redirectUri);

  const { factors, levelOfAssurance, methods, strategies } = extractAcrValues(acrValues);

  const elevationSession = await initialiseElevation(ctx, {
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
    uiLocales: uiLocales ? uiLocales.split(" ") : [],
  });

  return { redirect: createElevationPendingUri(elevationSession) };
};
