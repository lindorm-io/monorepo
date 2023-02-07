import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";

type RequestData = {
  id: string;
};

export const deleteTenantSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const deleteTenantController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    // cache: { clientCache },
    entity: { tenant },
    repository: { clientRepository, tenantRepository },
  } = ctx;

  await Promise.all([
    clientRepository.deleteMany({ tenant: tenant.id }),
    // clientCache.deleteMany({ tenant: tenant.id }),
    tenantRepository.destroy(tenant),
  ]);
};
