import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { Identifier } from "../../entity";
import { IdentifierType } from "../../common";
import { JOI_EMAIL, JOI_PHONE_NUMBER } from "../../common";
import { JOI_IDENTIFIER_TYPE } from "../../constant";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";
import { isPrimaryUsedByIdentifier } from "../../util";

interface RequestData {
  identifier: string;
  provider?: string;
  type: IdentifierType;
}

export const setPrimaryIdentifierSchema = Joi.object<RequestData>()
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

export const setPrimaryIdentifierController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { identifier, provider, type },
    entity: { identity },
    repository: { identifierRepository },
  } = ctx;

  if (!isPrimaryUsedByIdentifier(type)) {
    throw new ClientError("Invalid identifier type");
  }

  const identifierEntity = await identifierRepository.find({
    identifier,
    identityId: identity.id,
    provider: provider || configuration.server.domain,
    type,
  });

  if (!identifierEntity.verified) {
    throw new ClientError("Invalid request", {
      description: "Unable to set unverified identifier as primary",
    });
  }

  const updates: Array<Identifier> = [];

  try {
    const current = await identifierRepository.find({
      identityId: identifierEntity.identityId,
      primary: identifierEntity.primary,
      provider: identifierEntity.provider,
      type: identifierEntity.type,
    });

    current.primary = false;

    updates.push(current);
  } catch (err) {
    if (!(err instanceof EntityNotFoundError)) {
      throw err;
    }
  }

  identifierEntity.primary = true;
  updates.push(identifierEntity);

  await identifierRepository.updateMany(updates);
};
