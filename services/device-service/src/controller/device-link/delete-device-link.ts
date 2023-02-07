import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { destroyDeviceLinkCallback } from "../../handler";

interface RequestData {
  id: string;
}

export const deleteDeviceLinkSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const deleteDeviceLinkController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    entity: { deviceLink },
    repository: { deviceLinkRepository },
  } = ctx;

  await deviceLinkRepository.destroy(deviceLink, destroyDeviceLinkCallback(ctx));
};
