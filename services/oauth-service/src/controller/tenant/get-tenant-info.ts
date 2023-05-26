import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { TenantAttributes } from "../../entity";
import { ServerKoaController } from "../../types";

type RequestData = {
  id: string;
};

type ResponseBody = Partial<TenantAttributes>;

export const getTenantInfoSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getTenantInfoController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { tenant },
  } = ctx;

  return {
    body: {
      active: tenant.active,
      name: tenant.name,
      owner: tenant.owner,
      subdomain: tenant.subdomain,
      trusted: tenant.trusted,
    },
  };
};
