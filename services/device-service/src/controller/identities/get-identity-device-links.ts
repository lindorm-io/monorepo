import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { GetIdentityDeviceLinksResponseBody, JOI_GUID } from "../../common";
import { filter } from "lodash";

interface RequestData {
  id: string;
}

export const getIdentityDeviceLinksSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
});

export const getIdentityDeviceLinksController: ServerKoaController = async (
  ctx,
): ControllerResponse<GetIdentityDeviceLinksResponseBody> => {
  const {
    data: { id },
    repository: { deviceLinkRepository },
  } = ctx;

  const list = await deviceLinkRepository.findMany({ identityId: id });

  const filtered = filter(list, {
    active: true,
    trusted: true,
  });

  const deviceLinks = filtered.map((item) => item.id);

  return {
    body: { deviceLinks },
  };
};
