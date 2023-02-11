import Joi from "joi";
import { ClientAllowed, ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_CLIENT_TYPE } from "../../common";
import { JOI_GRANT_TYPE, JOI_RESPONSE_TYPE } from "../../constant";
import { OauthClientType } from "@lindorm-io/common-types";
import { isUndefined } from "lodash";

type RequestData = {
  id: string;
  active: boolean;
  allowed: ClientAllowed;
  type: OauthClientType;
};

export const adminClientSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    active: Joi.boolean(),
    allowed: Joi.object({
      grantTypes: Joi.array().items(JOI_GRANT_TYPE),
      responseTypes: Joi.array().items(JOI_RESPONSE_TYPE),
      scopes: Joi.array().items(Joi.string()),
    }),
    type: JOI_CLIENT_TYPE,
  })
  .required();

export const adminClientController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { clientCache },
    data: { active, allowed, type },
    entity: { client },
    repository: { clientRepository },
  } = ctx;

  if (!isUndefined(active)) client.active = active;
  if (!isUndefined(allowed?.grantTypes)) client.allowed.grantTypes = allowed.grantTypes;
  if (!isUndefined(allowed?.responseTypes)) client.allowed.responseTypes = allowed.responseTypes;
  if (!isUndefined(allowed?.scopes)) client.allowed.scopes = allowed.scopes;
  if (!isUndefined(type)) client.type = type;

  const updated = await clientRepository.update(client);
  await clientCache.update(updated);
};
