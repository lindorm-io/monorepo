import Joi from "joi";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
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

export const adminTenantController: Controller<Context<RequestData>> = async (
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
