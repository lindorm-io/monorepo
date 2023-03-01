import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_LEVEL_OF_ASSURANCE } from "../../common";
import { ServerKoaController } from "../../types";
import { assertSessionPending, createAuthorizationVerifyUri } from "../../util";
import {
  ConfirmLoginRequestBody,
  ConfirmLoginRequestParams,
  ConfirmLoginResponse,
  SessionStatus,
} from "@lindorm-io/common-types";

type RequestData = ConfirmLoginRequestParams & ConfirmLoginRequestBody;

type ResponseBody = ConfirmLoginResponse;

export const confirmLoginSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    identityId: Joi.string().guid().required(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
    metadata: Joi.object().required(),
    methods: Joi.array().items(Joi.string().lowercase()).required(),
    remember: Joi.boolean().required(),
    sso: Joi.boolean().required(),
  })
  .required();

export const confirmLoginController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { authorizationSessionCache },
    data: { identityId, levelOfAssurance, metadata, methods, remember, sso },
    entity: { authorizationSession },
    logger,
  } = ctx;

  assertSessionPending(authorizationSession.status.login);

  logger.debug("Updating authorization session");

  authorizationSession.confirmedLogin.identityId = identityId;
  authorizationSession.confirmedLogin.latestAuthentication = new Date();
  authorizationSession.confirmedLogin.levelOfAssurance = levelOfAssurance;
  authorizationSession.confirmedLogin.metadata = metadata;
  authorizationSession.confirmedLogin.methods = methods;
  authorizationSession.confirmedLogin.remember = remember;
  authorizationSession.confirmedLogin.sso = sso;

  authorizationSession.status.login = SessionStatus.CONFIRMED;

  await authorizationSessionCache.update(authorizationSession);

  return { body: { redirectTo: createAuthorizationVerifyUri(authorizationSession) } };
};
