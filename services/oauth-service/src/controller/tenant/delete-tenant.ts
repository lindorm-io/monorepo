import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID } from "../../common";

interface RequestData {
  id: string;
}

export const deleteTenantSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
});

export const deleteTenantController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    // cache: { clientCache },
    entity: { tenant },
    repository: { clientRepository, tenantRepository },
  } = ctx;

  await Promise.all([
    clientRepository.destroyMany({ tenant: tenant.id }),
    // clientCache.destroyMany({ tenant: tenant.id }),
    tenantRepository.destroy(tenant),
  ]);

  return { body: {} };
};
