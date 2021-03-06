import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID } from "../../common";

interface RequestData {
  id: string;
}

export const deleteTenantSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
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
