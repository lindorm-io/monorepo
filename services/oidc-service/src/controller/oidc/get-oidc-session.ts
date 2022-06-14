import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { GetOidcSessionResponseBody, JOI_GUID, LevelOfAssurance } from "../../common";
import { ServerKoaController } from "../../types";
import { findOidcConfiguration } from "../../util";

interface RequestData {
  id: string;
}

export const getOidcSessionSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const getOidcSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<GetOidcSessionResponseBody> => {
  const {
    entity: { oidcSession },
  } = ctx;

  const { identityId, provider, verified } = oidcSession;

  if (!verified) {
    throw new ClientError("Session not verified");
  }

  const config = findOidcConfiguration(provider);

  return {
    body: {
      identityId,
      levelOfAssurance: config.loa_value as LevelOfAssurance,
      provider,
    },
  };
};
