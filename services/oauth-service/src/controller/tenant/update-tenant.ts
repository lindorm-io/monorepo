import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { ServerKoaController } from "../../types";

type RequestData = {
  id: string;
  active: boolean;
  name: string;
  owner: string;
  subdomain: string;
  trusted: boolean;
};

export const updateTenantSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    active: Joi.boolean(),
    name: Joi.string(),
    owner: Joi.string(),
    subdomain: Joi.string(),
    trusted: Joi.boolean(),
  })
  .required();

export const updateTenantController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { active, name, owner, subdomain, trusted },
    entity: { tenant },
    mongo: { tenantRepository },
  } = ctx;

  if (active !== undefined) tenant.active = active;
  if (name !== undefined) tenant.name = name;
  if (owner !== undefined) tenant.owner = owner;
  if (subdomain !== undefined) tenant.subdomain = subdomain;
  if (trusted !== undefined) tenant.trusted = trusted;

  await tenantRepository.update(tenant);
};
