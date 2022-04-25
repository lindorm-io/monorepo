import Joi from "joi";
import { Controller, ControllerResponse, HttpStatus } from "@lindorm-io/koa";
import { Context } from "../../types";
import { Tenant } from "../../entity";

interface RequestData {
  name: string;
  subdomain: string;
}

interface ResponseBody {
  id: string;
}

export const createTenantSchema = Joi.object<RequestData>({
  name: Joi.string().required(),
  subdomain: Joi.string().required(),
});

export const createTenantController: Controller<Context<RequestData>> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { name, subdomain },
    repository: { tenantRepository },
    token: {
      bearerToken: { subject: identityId },
    },
  } = ctx;

  const tenant = await tenantRepository.create(
    new Tenant({
      active: true,
      administrators: [identityId],
      name,
      owner: identityId,
      subdomain,
    }),
  );

  return {
    body: { id: tenant.id },
    status: HttpStatus.Success.CREATED,
  };
};
