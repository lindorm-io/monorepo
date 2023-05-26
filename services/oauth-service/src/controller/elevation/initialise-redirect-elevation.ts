import {
  AuthenticationMethod,
  InitialiseElevationSessionRequestQuery,
} from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import {
  JOI_COUNTRY_CODE,
  JOI_JWT,
  JOI_LEVEL_OF_ASSURANCE,
  JOI_NONCE,
  JOI_STATE,
} from "../../common";
import { JOI_DISPLAY_MODE } from "../../constant";
import { initialiseElevation } from "../../handler";
import { ServerKoaController } from "../../types";
import { assertRedirectUri, createElevationPendingUri } from "../../util";

type RequestData = InitialiseElevationSessionRequestQuery;

export const initialiseRedirectElevationSchema = Joi.object<RequestData>()
  .keys({
    authenticationHint: Joi.array().items(Joi.string()),
    clientId: Joi.string().guid().required(),
    country: JOI_COUNTRY_CODE,
    display: JOI_DISPLAY_MODE,
    idTokenHint: JOI_JWT,
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE,
    methods: Joi.string(),
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
    data: {
      authenticationHint,
      country,
      display,
      levelOfAssurance,
      methods,
      nonce,
      redirectUri,
      state,
      uiLocales,
    },
    entity: { client },
  } = ctx;

  assertRedirectUri(client, redirectUri);

  const elevationSession = await initialiseElevation(ctx, {
    authenticationHint,
    country,
    display,
    levelOfAssurance,
    methods: methods ? (methods.split(" ") as Array<AuthenticationMethod>) : [],
    nonce,
    redirectUri,
    state,
    uiLocales: uiLocales ? uiLocales.split(" ") : [],
  });

  return { redirect: createElevationPendingUri(elevationSession) };
};
