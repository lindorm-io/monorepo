import { IdentifierType } from "@lindorm-io/common-enums";
import { ClientError } from "@lindorm-io/errors";
import Joi from "joi";

export const assertIdentifier = async (identifier: any, type: IdentifierType): Promise<void> => {
  switch (type) {
    case IdentifierType.EMAIL:
      await Joi.string()
        .case("lower")
        .email({
          minDomainSegments: 2,
          tlds: { deny: [] },
        })
        .validateAsync(identifier);
      break;

    case IdentifierType.EXTERNAL:
      await Joi.string().validateAsync(identifier);
      break;

    case IdentifierType.NIN:
    case IdentifierType.SSN:
      await Joi.string()
        .regex(/^\d{1,20}$/)
        .validateAsync(identifier);
      break;

    case IdentifierType.PHONE:
      await Joi.string()
        .regex(/^([+][1-9])?\d{1,20}$/)
        .validateAsync(identifier);
      break;

    case IdentifierType.USERNAME:
      await Joi.string()
        .case("lower")
        .regex(/^[A-Za-z0-9\.\-\_]+$/)
        .validateAsync(identifier);
      break;

    default:
      throw new ClientError("Unexpected type");
  }
};
