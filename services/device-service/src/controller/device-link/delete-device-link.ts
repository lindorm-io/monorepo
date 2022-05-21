import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID } from "../../common";
import { ServerKoaController } from "../../types";
import { destroyDeviceLinkCallback } from "../../handler";

interface RequestData {
  id: string;
}

export const deleteDeviceLinkSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
});

export const deleteDeviceLinkController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    entity: { deviceLink },
    repository: { deviceLinkRepository },
  } = ctx;

  await deviceLinkRepository.destroy(deviceLink, destroyDeviceLinkCallback(ctx));

  return {
    body: {},
  };
};
