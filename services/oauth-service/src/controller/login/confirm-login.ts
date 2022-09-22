import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { assertAcrValues, assertSessionPending, createAuthorizationVerifyUri } from "../../util";
import {
  ConfirmLoginRequestBody,
  JOI_GUID,
  JOI_LEVEL_OF_ASSURANCE,
  ResponseWithRedirectBody,
  SessionStatus,
} from "../../common";

interface RequestData extends ConfirmLoginRequestBody {
  id: string;
}

export const confirmLoginSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
    acrValues: Joi.array().items(Joi.string().lowercase()).required(),
    amrValues: Joi.array().items(Joi.string().lowercase()).required(),
    identityId: JOI_GUID.required(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
    remember: Joi.boolean().required(),
  })
  .required();

export const confirmLoginController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseWithRedirectBody> => {
  const {
    cache: { authorizationSessionCache },
    data: { acrValues, amrValues, identityId, levelOfAssurance, remember },
    entity: { authorizationSession },
    logger,
  } = ctx;

  assertSessionPending(authorizationSession.status.login);
  assertAcrValues(acrValues);

  logger.debug("Updating authorization session");

  authorizationSession.confirmedLogin.acrValues = acrValues;
  authorizationSession.confirmedLogin.amrValues = amrValues;
  authorizationSession.confirmedLogin.identityId = identityId;
  authorizationSession.confirmedLogin.latestAuthentication = new Date();
  authorizationSession.confirmedLogin.levelOfAssurance = levelOfAssurance;
  authorizationSession.confirmedLogin.remember = remember === true;

  authorizationSession.status.login = SessionStatus.CONFIRMED;

  await authorizationSessionCache.update(authorizationSession);

  return { body: { redirectTo: createAuthorizationVerifyUri(authorizationSession) } };
};
