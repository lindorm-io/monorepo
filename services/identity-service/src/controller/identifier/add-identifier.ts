import Joi from "joi";
import { AddIdentifierRequestBody, IdentifierType } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_IDENTIFIER_TYPE } from "../../constant";
import { ServerKoaController } from "../../types";
import { addGenericIdentifier, addUsernameIdentifier } from "../../handler";
import { assertIdentifier } from "../../util";

type RequestData = AddIdentifierRequestBody;

export const addIdentifierSchema = Joi.object<RequestData>()
  .keys({
    identityId: Joi.string().guid().required(),
    identifier: Joi.string().required(),
    label: Joi.string().allow(null).required(),
    provider: Joi.string(),
    type: JOI_IDENTIFIER_TYPE.required(),
    verified: Joi.boolean().required(),
  })
  .options({ abortEarly: false })
  .required();

export const addIdentifierController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { identifier, label, provider, type, verified },
    entity: { identity },
  } = ctx;

  await assertIdentifier(identifier, type);

  switch (type) {
    case IdentifierType.EMAIL:
    case IdentifierType.EXTERNAL:
    case IdentifierType.NIN:
    case IdentifierType.PHONE:
    case IdentifierType.SSN:
      await addGenericIdentifier(ctx, identity, {
        label: label || undefined,
        provider,
        type,
        value: identifier,
        verified,
      });
      break;

    case IdentifierType.USERNAME:
      await addUsernameIdentifier(ctx, identity, identifier);
      break;

    default:
      throw new ClientError("Unexpected type");
  }
};
