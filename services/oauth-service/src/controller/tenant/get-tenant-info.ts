import Joi from "joi";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID } from "../../common";
import { TenantAttributes } from "../../entity";

interface RequestData {
  id: string;
}

type ResponseBody = Partial<TenantAttributes>;

export const getTenantInfoSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
});

export const getTenantInfoController: Controller<Context<RequestData>> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { tenant },
  } = ctx;

  return {
    body: {
      active: tenant.active,
      administrators: tenant.administrators,
      name: tenant.name,
      owner: tenant.owner,
      subdomain: tenant.subdomain,
    },
  };
};
