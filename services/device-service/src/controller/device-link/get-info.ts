import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { DeviceLinkAttributes } from "../../entity";
import { ServerKoaController } from "../../types";

interface RequestData {
  id: string;
}

export const getDeviceLinkInfoSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getDeviceLinkInfoController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<Partial<DeviceLinkAttributes>> => {
  const {
    entity: { deviceLink },
    token: { bearerToken },
  } = ctx;

  if (deviceLink.identityId !== bearerToken.subject) {
    throw new ClientError("Invalid bearer token");
  }

  const { id, active, identityId, installationId, metadata, name, trusted, uniqueId } = deviceLink;

  return {
    body: {
      id,
      active,
      identityId,
      installationId,
      metadata,
      name,
      trusted,
      uniqueId,
    },
  };
};
