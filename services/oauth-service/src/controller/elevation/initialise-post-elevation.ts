import {
  InitialiseElevationResponse,
  InitialiseElevationSessionRequestBody,
} from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import {
  JOI_COUNTRY_CODE,
  JOI_JWT,
  JOI_LEVEL_OF_ASSURANCE,
  JOI_LOCALE,
  JOI_NONCE,
} from "../../common";
import { initialiseElevation } from "../../handler";
import { ServerKoaController } from "../../types";

type RequestData = InitialiseElevationSessionRequestBody;

type ResponseBody = InitialiseElevationResponse;

export const initialisePostElevationSchema = Joi.object<RequestData>()
  .keys({
    authenticationHint: Joi.array().items(Joi.string()),
    clientId: Joi.string().guid().required(),
    country: JOI_COUNTRY_CODE,
    factors: Joi.array().items(Joi.string().lowercase()),
    idTokenHint: JOI_JWT,
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE,
    methods: Joi.array().items(Joi.string().lowercase()),
    nonce: JOI_NONCE,
    strategies: Joi.array().items(Joi.string().lowercase()),
    uiLocales: Joi.array().items(JOI_LOCALE),
  })
  .options({ abortEarly: false })
  .required();

export const initialisePostElevationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: {
      authenticationHint,
      country,
      factors,
      levelOfAssurance,
      methods,
      nonce,
      strategies,
      uiLocales,
    },
  } = ctx;

  const elevationSession = await initialiseElevation(ctx, {
    authenticationHint,
    country,
    factors,
    levelOfAssurance,
    methods,
    nonce,
    strategies,
    uiLocales,
  });

  return { body: { elevationSessionId: elevationSession.id } };
};
