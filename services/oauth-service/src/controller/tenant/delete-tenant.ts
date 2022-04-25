import Joi from "joi";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID } from "../../common";

interface RequestData {
  id: string;
}

export const deleteTenantSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
});

export const deleteTenantController: Controller<Context<RequestData>> = async (
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
