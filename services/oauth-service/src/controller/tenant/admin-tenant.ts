import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { isUndefined } from "lodash";

type RequestData = {
  id: string;
  active: boolean;
  owner: string;
};

export const adminTenantSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    active: Joi.boolean().optional(),
    owner: Joi.string().optional(),
  })
  .required();

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
};
