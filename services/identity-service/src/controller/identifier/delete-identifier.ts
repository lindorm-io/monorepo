import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { IdentifierType } from "../../common";
import { JOI_EMAIL, JOI_PHONE_NUMBER } from "../../common";
import { JOI_IDENTIFIER_TYPE } from "../../constant";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";

interface RequestData {
  identifier: string;
  provider?: string;
  type: IdentifierType;
}

export const deleteIdentifierSchema = Joi.object<RequestData>()
  .keys({
    identifier: Joi.when("type", {
      switch: [
        { is: IdentifierType.EMAIL, then: JOI_EMAIL.required() },
        { is: IdentifierType.EXTERNAL, then: Joi.string().required() },
        { is: IdentifierType.PHONE, then: JOI_PHONE_NUMBER.required() },
      ],
      otherwise: Joi.forbidden(),
    }),
    provider: Joi.when("type", {
      is: IdentifierType.EXTERNAL,
      then: Joi.string().uri().required(),
      otherwise: Joi.forbidden(),
    }),
    type: JOI_IDENTIFIER_TYPE.required(),
  })
  .required();

export const deleteIdentifierController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { identifier, provider, type },
    entity: { identity },
    repository: { identifierRepository },
  } = ctx;

  const identifierEntity = await identifierRepository.find({
    identifier,
    identityId: identity.id,
    provider: provider || configuration.server.domain,
    type,
  });

  await identifierRepository.destroy(identifierEntity);
};
