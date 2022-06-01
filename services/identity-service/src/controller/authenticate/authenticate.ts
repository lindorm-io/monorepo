import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { IdentifierType, JOI_NIN } from "../../common";
import { Identity } from "../../entity";
import { JOI_IDENTIFIER_TYPE } from "../../constant";
import {
  verifyEmail,
  verifyExternalIdentifier,
  verifyNationalIdentityNumber,
  verifyPhoneNumber,
} from "../../handler";
import {
  AuthenticateIdentifierRequestData,
  AuthenticateIdentifierResponseBody,
  JOI_EMAIL,
  JOI_GUID,
  JOI_PHONE_NUMBER,
} from "../../common";

export const authenticateIdentifierSchema = Joi.object<AuthenticateIdentifierRequestData>()
  .keys({
    identifier: Joi.when("type", {
      switch: [
        { is: IdentifierType.EMAIL, then: JOI_EMAIL.required() },
        { is: IdentifierType.EXTERNAL, then: Joi.string().required() },
        { is: IdentifierType.NIN, then: JOI_NIN.required() },
        { is: IdentifierType.PHONE, then: JOI_PHONE_NUMBER.required() },
        { is: IdentifierType.USERNAME, then: Joi.string().required() },
      ],
      otherwise: Joi.forbidden(),
    }),
    identityId: JOI_GUID.optional(),
    provider: Joi.when("type", {
      is: IdentifierType.EXTERNAL,
      then: Joi.string().uri().required(),
      otherwise: Joi.forbidden(),
    }),
    type: JOI_IDENTIFIER_TYPE.required(),
  })
  .required();

export const authenticateIdentifierController: ServerKoaController<
  AuthenticateIdentifierRequestData
> = async (ctx): ControllerResponse<AuthenticateIdentifierResponseBody> => {
  const {
    data: { identifier, identityId, provider, type },
    repository: { identityRepository },
  } = ctx;

  let identity: Identity;

  switch (type) {
    case IdentifierType.EMAIL:
      identity = await verifyEmail(ctx, { identityId, email: identifier });
      break;

    case IdentifierType.EXTERNAL:
      identity = await verifyExternalIdentifier(ctx, {
        identifier,
        identityId,
        provider,
      });
      break;

    case IdentifierType.NIN:
      identity = await verifyNationalIdentityNumber(ctx, {
        identityId,
        nationalIdentityNumber: identifier,
      });
      break;

    case IdentifierType.PHONE:
      identity = await verifyPhoneNumber(ctx, { identityId, phoneNumber: identifier });
      break;

    case IdentifierType.USERNAME:
      identity = await identityRepository.find({
        ...(identityId ? { id: identityId } : {}),
        username: identifier,
      });
      break;

    default:
      throw new ClientError("Unexpected identifier type");
  }

  return { body: { identityId: identity.id } };
};
