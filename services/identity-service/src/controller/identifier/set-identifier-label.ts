import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { IdentifierType } from "../../common";
import { JOI_EMAIL, JOI_PHONE_NUMBER } from "../../common";
import { JOI_IDENTIFIER_TYPE } from "../../constant";
import { ServerKoaController } from "../../types";
import { findVerifiedIdentifier } from "../../handler";

interface RequestData {
  identifier: string;
  label: string | null;
  provider?: string;
  type: IdentifierType;
}

export const setIdentifierLabelSchema = Joi.object<RequestData>()
  .keys({
    identifier: Joi.when("type", {
      switch: [
        { is: IdentifierType.EMAIL, then: JOI_EMAIL.required() },
        { is: IdentifierType.EXTERNAL, then: Joi.string().required() },
        { is: IdentifierType.PHONE, then: JOI_PHONE_NUMBER.required() },
      ],
      otherwise: Joi.forbidden(),
    }),
    label: Joi.string().allow(null).required(),
    provider: Joi.when("type", {
      is: IdentifierType.EXTERNAL,
      then: Joi.string().uri().required(),
      otherwise: Joi.forbidden(),
    }),
    type: JOI_IDENTIFIER_TYPE.required(),
  })
  .required();

export const setIdentifierLabelController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { identifier, label, provider, type },
    entity: { identity },
    repository: { identifierRepository },
  } = ctx;

  const identifierEntity = await findVerifiedIdentifier(ctx, identity, {
    identifier,
    provider,
    type,
  });

  identifierEntity.label = label;

  await identifierRepository.update(identifierEntity);
};
