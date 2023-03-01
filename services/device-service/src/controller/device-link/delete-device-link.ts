import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { destroyDeviceLinkCallback } from "../../handler";
import { ClientError } from "@lindorm-io/errors";

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
    token: { bearerToken },
  } = ctx;

  if (deviceLink.identityId !== bearerToken.subject) {
    throw new ClientError("Invalid bearer token");
  }

  await deviceLinkRepository.destroy(deviceLink, destroyDeviceLinkCallback(ctx));
};
