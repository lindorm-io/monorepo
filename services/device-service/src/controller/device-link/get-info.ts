import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { DeviceLinkAttributes } from "../../entity";

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
  } = ctx;

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
