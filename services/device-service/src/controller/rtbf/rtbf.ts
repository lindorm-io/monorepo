import { ControllerResponse } from "@lindorm-io/koa";
import { destroyDeviceLinkCallback } from "../../handler";
import { ServerKoaController } from "../../types";

export const rtbfController: ServerKoaController = async (ctx): ControllerResponse => {
  const {
    mongo: { deviceLinkRepository },
    token: {
      bearerToken: { subject: identityId },
    },
  } = ctx;

  const deviceLinks = await deviceLinkRepository.findMany({ identityId });
  await deviceLinkRepository.destroyMany(deviceLinks, destroyDeviceLinkCallback(ctx));
};
