import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { findOidcConfiguration } from "../../util";
import {
  GetOidcSessionRequestParams,
  GetOidcSessionResponse,
  LevelOfAssurance,
} from "@lindorm-io/common-types";

type RequestData = GetOidcSessionRequestParams;

type ResponseBody = GetOidcSessionResponse;

export const getOidcSessionSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getOidcSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { oidcSession },
  } = ctx;

  const { callbackId, identityId, provider, verified } = oidcSession;

  if (!identityId) {
    throw new ClientError("Session not completed");
  }

  if (!verified) {
    throw new ClientError("Session not verified");
  }

  const config = findOidcConfiguration(provider);

  return {
    body: {
      callbackId,
      identityId,
      levelOfAssurance: config.loa_value as LevelOfAssurance,
      provider,
    },
  };
};
