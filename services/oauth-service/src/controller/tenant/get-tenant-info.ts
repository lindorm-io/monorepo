import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { TenantAttributes } from "../../entity";

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
      administrators: tenant.administrators,
      name: tenant.name,
      owner: tenant.owner,
      subdomain: tenant.subdomain,
    },
  };
};
