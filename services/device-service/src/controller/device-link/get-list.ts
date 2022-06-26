import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { DeviceLinkAttributes } from "../../entity";

interface ResponseBody {
  deviceLinks: Array<Partial<DeviceLinkAttributes>>;
}

export const getDeviceLinkListController: ServerKoaController = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    repository: { deviceLinkRepository },
    token: {
      bearerToken: { subject: identityId },
    },
  } = ctx;

  const list = await deviceLinkRepository.findMany({ identityId });
  const deviceLinks: Array<Partial<DeviceLinkAttributes>> = [];

  for (const deviceLink of list) {
    deviceLinks.push({
      id: deviceLink.id,
      active: deviceLink.active,
      metadata: deviceLink.metadata,
      name: deviceLink.name,
      trusted: deviceLink.trusted,
    });
  }

  return { body: { deviceLinks } };
};
