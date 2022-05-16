import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID } from "../../common";
import { isUndefined } from "lodash";

interface RequestData {
  id: string;
  active: boolean;
  owner: string;
}

export const adminTenantSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
  active: Joi.boolean().optional(),
  owner: Joi.string().optional(),
});

export const adminTenantController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { active, owner },
    entity: { tenant },
    repository: { tenantRepository },
  } = ctx;

  if (!isUndefined(active)) tenant.active = active;
  if (!isUndefined(owner)) tenant.owner = owner;

  await tenantRepository.update(tenant);

  return { body: {} };
};
