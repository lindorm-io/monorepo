import {
  GetFederationSessionRequestParams,
  GetFederationSessionResponse,
  LevelOfAssurance,
} from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { ServerKoaController } from "../../types";
import { findFederationConfiguration } from "../../util";

type RequestData = GetFederationSessionRequestParams;

type ResponseBody = GetFederationSessionResponse;

export const getFederationSessionSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getFederationSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { federationSession },
  } = ctx;

  const { callbackId, identityId, provider, verified } = federationSession;

  if (!identityId) {
    throw new ClientError("Session not completed");
  }

  if (!verified) {
    throw new ClientError("Session not verified");
  }

  const config = findFederationConfiguration(provider);

  return {
    body: {
      callbackId,
      identityId,
      levelOfAssurance: config.loa_value as LevelOfAssurance,
      provider,
    },
  };
};
