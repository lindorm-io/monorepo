import Joi from "joi";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID } from "../../common";

interface RequestData {
  id: string;
}

export const removeDeviceLinkSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
});

export const removeDeviceLinkController: Controller<Context<RequestData>> = async (
  ctx,
): ControllerResponse => {
  const {
    entity: { deviceLink },
    repository: { deviceLinkRepository },
  } = ctx;

  await deviceLinkRepository.destroy(deviceLink);

  return {
    body: {},
  };
};
