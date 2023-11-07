import {
  ConfirmLoginRequestBody,
  ConfirmLoginRequestParams,
  ConfirmLoginResponse,
} from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { JOI_LEVEL_OF_ASSURANCE } from "../../common";
import { ServerKoaController } from "../../types";
import { assertSessionPending, createAuthorizationVerifyUri } from "../../util";

type RequestData = ConfirmLoginRequestParams & ConfirmLoginRequestBody;

type ResponseBody = ConfirmLoginResponse;

export const confirmLoginSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    factors: Joi.array().items(Joi.string().lowercase()).required(),
    identityId: Joi.string().guid().required(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
    metadata: Joi.object().required(),
    methods: Joi.array().items(Joi.string().lowercase()).required(),
    remember: Joi.boolean().required(),
    singleSignOn: Joi.boolean().required(),
    strategies: Joi.array().items(Joi.string().lowercase()).required(),
  })
  .required();

export const confirmLoginController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    redis: { authorizationSessionCache },
    data: {
      factors,
      identityId,
      levelOfAssurance,
      metadata,
      methods,
      remember,
      singleSignOn,
      strategies,
    },
    entity: { authorizationSession },
    logger,
  } = ctx;

  assertSessionPending(authorizationSession.status.login);

  logger.debug("Updating authorization session");

  authorizationSession.confirmLogin({
    factors,
    identityId,
    latestAuthentication: new Date(),
    levelOfAssurance,
    metadata,
    methods,
    remember,
    singleSignOn,
    strategies,
  });

  await authorizationSessionCache.update(authorizationSession);

  return { body: { redirectTo: createAuthorizationVerifyUri(authorizationSession) } };
};
