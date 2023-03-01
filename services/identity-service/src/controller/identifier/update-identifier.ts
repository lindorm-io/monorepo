import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import {
  UpdateIdentifierRequestBody,
  UpdateIdentifierRequestParams,
} from "@lindorm-io/common-types";

type RequestData = UpdateIdentifierRequestParams & UpdateIdentifierRequestBody;

export const updateIdentifierSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    label: Joi.string().allow(null),
    primary: Joi.boolean().allow(true),
  })
  .options({ abortEarly: false })
  .required();

export const updateIdentifierController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { label, primary },
    entity: { identity, identifier },
    repository: { identifierRepository },
  } = ctx;

  if (label !== undefined) {
    identifier.label = label;
  }

  if (primary === undefined) {
    await identifierRepository.update(identifier);

    return;
  }

  const current = await identifierRepository.tryFind({
    identityId: identity.id,
    primary: true,
    provider: identifier.provider,
    type: identifier.type,
  });

  if (current) {
    current.primary = false;

    await identifierRepository.update(current);
  }

  identifier.primary = true;

  await identifierRepository.update(identifier);
};
