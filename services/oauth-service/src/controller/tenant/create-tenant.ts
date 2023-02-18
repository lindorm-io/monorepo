import Joi from "joi";
import { ControllerResponse, HttpStatus } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { Tenant } from "../../entity";
import { configuration } from "../../server/configuration";

type RequestData = {
  name: string;
  owner: string;
  subdomain: string;
};

type ResponseBody = {
  id: string;
};

export const createTenantSchema = Joi.object<RequestData>()
  .keys({
    name: Joi.string().required(),
    owner: Joi.string().guid().required(),
    subdomain: Joi.string().required(),
  })
  .required();

export const createTenantController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { name, owner, subdomain },
    repository: { tenantRepository },
  } = ctx;

  const tenant = await tenantRepository.create(
    new Tenant({
      active: configuration.defaults.tenants.active_state,
      name,
      owner,
      subdomain,
    }),
  );

  return {
    body: { id: tenant.id },
    status: HttpStatus.Success.CREATED,
  };
};
