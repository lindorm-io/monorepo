import { ControllerResponse, HttpStatus } from "@lindorm-io/koa";
import Joi from "joi";
import { Tenant } from "../../entity";
import { ServerKoaController } from "../../types";

type RequestData = {
  name: string;
  owner: string;
  subdomain: string;
  trusted: boolean;
};

type ResponseBody = {
  id: string;
};

export const createTenantSchema = Joi.object<RequestData>()
  .keys({
    name: Joi.string().required(),
    owner: Joi.string().guid().required(),
    subdomain: Joi.string().required(),
    trusted: Joi.boolean().required(),
  })
  .required();

export const createTenantController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { name, owner, subdomain, trusted },
    mongo: { tenantRepository },
  } = ctx;

  const tenant = await tenantRepository.create(
    new Tenant({
      active: true,
      name,
      owner,
      subdomain,
      trusted,
    }),
  );

  return {
    body: { id: tenant.id },
    status: HttpStatus.Success.CREATED,
  };
};
