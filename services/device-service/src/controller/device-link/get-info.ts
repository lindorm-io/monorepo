import Joi from "joi";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { DeviceLinkAttributes } from "../../entity";
import { JOI_GUID } from "../../common";

interface RequestData {
  id: string;
}

export const getDeviceLinkInfoSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
});

export const getDeviceLinkInfoController: Controller<Context<RequestData>> = async (
  ctx,
): ControllerResponse<Partial<DeviceLinkAttributes>> => {
  const {
    entity: { deviceLink },
  } = ctx;

  const { id, active, identityId, installationId, deviceMetadata, name, trusted, uniqueId } =
    deviceLink;

  return {
    body: {
      id,
      active,
      identityId,
      installationId,
      deviceMetadata,
      name,
      trusted,
      uniqueId,
    },
  };
};
