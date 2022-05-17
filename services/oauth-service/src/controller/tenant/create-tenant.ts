import Joi from "joi";
import { ControllerResponse, HttpStatus } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { Tenant } from "../../entity";
import { configuration } from "../../server/configuration";

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

export const createTenantController: ServerKoaController<RequestData> = async (
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
      active: configuration.defaults.tenant_active_state,
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
