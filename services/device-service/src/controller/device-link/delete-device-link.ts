import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { destroyDeviceLinkCallback } from "../../handler";
import { ServerKoaController } from "../../types";

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
    mongo: { deviceLinkRepository },
    token: { bearerToken },
  } = ctx;

  if (deviceLink.identityId !== bearerToken.subject) {
    throw new ClientError("Invalid bearer token");
  }

  await deviceLinkRepository.destroy(deviceLink, destroyDeviceLinkCallback(ctx));
};
