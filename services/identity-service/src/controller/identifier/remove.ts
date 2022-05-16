import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { IdentifierType } from "../../common";
import { JOI_EMAIL, JOI_GUID, JOI_PHONE_NUMBER } from "../../common";
import { JOI_IDENTIFIER_TYPE } from "../../constant";
import { removeEmail, removeExternalIdentifier, removePhoneNumber } from "../../handler";

interface RequestData {
  id: string;
  type: IdentifierType;

  email: string;
  identifier: string;
  phoneNumber: string;
  provider: string;
}

export const identifierRemoveSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
  type: JOI_IDENTIFIER_TYPE.required(),

  email: Joi.when("type", {
    is: IdentifierType.EMAIL,
    then: JOI_EMAIL.required(),
    otherwise: Joi.forbidden(),
  }),
  identifier: Joi.when("type", {
    is: IdentifierType.EXTERNAL,
    then: Joi.string().required(),
    otherwise: Joi.forbidden(),
  }),
  phoneNumber: Joi.when("type", {
    is: IdentifierType.PHONE,
    then: JOI_PHONE_NUMBER.required(),
    otherwise: Joi.forbidden(),
  }),
  provider: Joi.when("type", {
    is: IdentifierType.EXTERNAL,
    then: Joi.string().uri().required(),
    otherwise: Joi.forbidden(),
  }),
});

export const identifierRemoveController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { email, identifier, phoneNumber, type },
    entity: { identity },
  } = ctx;

  switch (type) {
    case IdentifierType.EMAIL:
      await removeEmail(ctx, {
        identityId: identity.id,
        email,
      });
      break;

    case IdentifierType.PHONE:
      await removePhoneNumber(ctx, {
        identityId: identity.id,
        phoneNumber,
      });
      break;

    case IdentifierType.EXTERNAL:
      await removeExternalIdentifier(ctx, {
        identityId: identity.id,
        identifier,
      });
      break;

    default:
      throw new ClientError("Unexpected identifier type");
  }

  return {
    body: {},
  };
};
