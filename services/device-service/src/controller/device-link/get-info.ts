import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { DeviceLinkAttributes } from "../../entity";
import { JOI_GUID } from "../../common";

interface RequestData {
  id: string;
}

export const getDeviceLinkInfoSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
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
