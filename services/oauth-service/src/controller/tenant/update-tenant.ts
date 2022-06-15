import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID } from "../../common";
import { isUndefined } from "lodash";

interface RequestData {
  id: string;
  administrators: Array<string>;
  name: string;
  owner: string;
  subdomain: string;
}

export const updateTenantSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
    administrators: Joi.array().items(Joi.string()).optional(),
    name: Joi.string().optional(),
    owner: Joi.string().optional(),
    subdomain: Joi.string().optional(),
  })
  .required();

export const updateTenantController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { administrators, name, owner, subdomain },
    entity: { tenant },
    repository: { tenantRepository },
  } = ctx;

  if (!isUndefined(administrators)) tenant.administrators = administrators;
  if (!isUndefined(name)) tenant.name = name;
  if (!isUndefined(owner)) tenant.owner = owner;
  if (!isUndefined(subdomain)) tenant.subdomain = subdomain;

  await tenantRepository.update(tenant);
};
