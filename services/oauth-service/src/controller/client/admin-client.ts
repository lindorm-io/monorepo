import Joi from "joi";
import { ClientAllowed, ServerKoaController } from "../../types";
import { ClientType, JOI_CLIENT_TYPE, JOI_GUID } from "../../common";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GRANT_TYPE, JOI_RESPONSE_TYPE } from "../../constant";
import { isUndefined } from "lodash";

interface RequestData {
  id: string;
  active: boolean;
  allowed: ClientAllowed;
  permissions: Array<string>;
  type: ClientType;
}

export const adminClientSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
  active: Joi.boolean().optional(),
  allowed: Joi.object({
    grantTypes: Joi.array().items(JOI_GRANT_TYPE).optional(),
    responseTypes: Joi.array().items(JOI_RESPONSE_TYPE).optional(),
    scopes: Joi.array().items(Joi.string()).optional(),
  }).optional(),
  permissions: Joi.array().items(Joi.string()).optional(),
  type: JOI_CLIENT_TYPE.optional(),
});

export const adminClientController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { clientCache },
    data: { active, allowed, permissions, type },
    entity: { client },
    repository: { clientRepository },
  } = ctx;

  if (!isUndefined(active)) client.active = active;
  if (!isUndefined(allowed?.grantTypes)) client.allowed.grantTypes = allowed.grantTypes;
  if (!isUndefined(allowed?.responseTypes)) client.allowed.responseTypes = allowed.responseTypes;
  if (!isUndefined(allowed?.scopes)) client.allowed.scopes = allowed.scopes;
  if (!isUndefined(permissions)) client.permissions = permissions;
  if (!isUndefined(type)) client.type = type;

  const updated = await clientRepository.update(client);
  await clientCache.update(updated);

  return { body: {} };
};
