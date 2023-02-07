import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_NIN } from "../../common";
import { Identity } from "../../entity";
import { JOI_IDENTIFIER_TYPE } from "../../constant";
import { ServerKoaController } from "../../types";
import { authenticateIdentifier, authenticateNationalIdentityNumber } from "../../handler";
import { JOI_EMAIL, JOI_PHONE_NUMBER } from "../../common";
import {
  AuthenticateIdentifierRequestBody,
  AuthenticateIdentifierResponse,
  IdentifierTypes,
} from "@lindorm-io/common-types";

type RequestData = AuthenticateIdentifierRequestBody;

type ResponseBody = AuthenticateIdentifierResponse;

export const authenticateIdentifierSchema = Joi.object<RequestData>()
  .keys({
    identifier: Joi.when("type", {
      switch: [
        { is: IdentifierTypes.EMAIL, then: JOI_EMAIL.required() },
        { is: IdentifierTypes.EXTERNAL, then: Joi.string().required() },
        { is: IdentifierTypes.NIN, then: JOI_NIN.required() },
        { is: IdentifierTypes.PHONE, then: JOI_PHONE_NUMBER.required() },
        { is: IdentifierTypes.USERNAME, then: Joi.string().required() },
      ],
      otherwise: Joi.forbidden(),
    }),
    identityId: Joi.string().guid().optional(),
    provider: Joi.when("type", {
      is: IdentifierTypes.EXTERNAL,
      then: Joi.string().uri().required(),
      otherwise: Joi.forbidden(),
    }),
    type: JOI_IDENTIFIER_TYPE.required(),
  })
  .required();

export const authenticateIdentifierController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { identifier, identityId, provider, type },
    repository: { identityRepository },
  } = ctx;

  let identity: Identity;

  switch (type) {
    case IdentifierTypes.EMAIL:
    case IdentifierTypes.EXTERNAL:
    case IdentifierTypes.PHONE:
      identity = await authenticateIdentifier(ctx, {
        identifier,
        identityId,
        provider,
        type,
      });
      break;

    case IdentifierTypes.NIN:
      identity = await authenticateNationalIdentityNumber(ctx, {
        identityId,
        nationalIdentityNumber: identifier,
      });
      break;

    case IdentifierTypes.USERNAME:
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
