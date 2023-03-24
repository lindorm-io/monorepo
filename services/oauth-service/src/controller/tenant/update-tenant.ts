import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { isUndefined } from "lodash";

type RequestData = {
  id: string;
  active: boolean;
  name: string;
  owner: string;
  subdomain: string;
};

export const updateTenantSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    active: Joi.boolean(),
    name: Joi.string(),
    owner: Joi.string(),
    subdomain: Joi.string(),
  })
  .required();

export const updateTenantController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { active, name, owner, subdomain },
    entity: { tenant },
    mongo: { tenantRepository },
  } = ctx;

  if (!isUndefined(active)) tenant.active = active;
  if (!isUndefined(name)) tenant.name = name;
  if (!isUndefined(owner)) tenant.owner = owner;
  if (!isUndefined(subdomain)) tenant.subdomain = subdomain;

  await tenantRepository.update(tenant);
};
