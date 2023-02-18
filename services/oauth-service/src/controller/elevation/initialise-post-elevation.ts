import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { InitialiseElevateRequestBody, InitialiseElevateResponse } from "@lindorm-io/common-types";
import { JOI_DISPLAY_MODE } from "../../constant";
import { ServerKoaController } from "../../types";
import { initialiseElevation } from "../../handler";
import {
  JOI_COUNTRY_CODE,
  JOI_JWT,
  JOI_LEVEL_OF_ASSURANCE,
  JOI_LOCALE,
  JOI_NONCE,
} from "../../common";

type RequestData = InitialiseElevateRequestBody;

type ResponseBody = InitialiseElevateResponse;

export const initialisePostElevationSchema = Joi.object<RequestData>()
  .keys({
    authenticationHint: Joi.array().items(Joi.string()),
    clientId: Joi.string().guid().required(),
    country: JOI_COUNTRY_CODE,
    display: JOI_DISPLAY_MODE,
    idTokenHint: JOI_JWT,
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE,
    methods: Joi.array().items(Joi.string()),
    nonce: JOI_NONCE,
    uiLocales: Joi.array().items(JOI_LOCALE),
  })
  .options({ abortEarly: false })
  .required();

export const initialisePostElevationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { authenticationHint, country, display, levelOfAssurance, methods, nonce, uiLocales },
  } = ctx;

  const elevationSession = await initialiseElevation(ctx, {
    authenticationHint,
    country,
    display,
    levelOfAssurance,
    methods,
    nonce,
    uiLocales,
  });

  return { body: { elevationSessionId: elevationSession.id } };
};
