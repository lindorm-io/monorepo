import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { filter } from "lodash";
import { GetIdentityDeviceLinksResponse } from "@lindorm-io/common-types";

interface RequestData {
  id: string;
}

export const getIdentityDeviceLinksSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getIdentityDeviceLinksController: ServerKoaController = async (
  ctx,
): ControllerResponse<GetIdentityDeviceLinksResponse> => {
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

  return { body: { deviceLinks } };
};
