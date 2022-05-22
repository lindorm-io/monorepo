import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { destroyDeviceLinkCallback } from "../../handler";

export const rtbfController: ServerKoaController = async (ctx): ControllerResponse => {
  const {
    repository: { deviceLinkRepository },
    token: {
      bearerToken: { subject: identityId },
    },
  } = ctx;

  const deviceLinks = await deviceLinkRepository.findMany({ identityId });
  await deviceLinkRepository.destroyMany(deviceLinks, destroyDeviceLinkCallback(ctx));

  return {};
};
