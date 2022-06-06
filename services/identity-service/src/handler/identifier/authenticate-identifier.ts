import { ClientError, ServerError } from "@lindorm-io/errors";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { Identifier, Identity } from "../../entity";
import { IdentifierType } from "../../common";
import { ServerKoaContext } from "../../types";
import { configuration } from "../../server/configuration";
import { isIdentifierStoredSeparately, isPrimaryUsedByIdentifier } from "../../util";

interface Options {
  identifier: string;
  identityId?: string;
  provider?: string;
  type: IdentifierType;
}

export const authenticateIdentifier = async (
  ctx: ServerKoaContext,
  options: Options,
): Promise<Identity> => {
  const {
    repository: { identifierRepository, identityRepository },
  } = ctx;

  const { identifier, identityId, type } = options;
  const provider = options.provider || configuration.server.domain;

  if (!isIdentifierStoredSeparately(type)) {
    throw new ServerError("Invalid identifier type", {
      debug: { type },
    });
  }

  try {
    const identifierEntity = await identifierRepository.find({ identifier, provider, type });

    if (identityId && identifierEntity.identityId !== identityId) {
      throw new ClientError("Unauthorized", {
        description: "Invalid Identity",
        debug: {
          expect: identityId,
          actual: identifierEntity.identityId,
        },
        statusCode: ClientError.StatusCode.UNAUTHORIZED,
      });
    }

    if (!identifierEntity.verified) {
      identifierEntity.verified = true;
      await identifierRepository.update(identifierEntity);
    }

    return await identityRepository.find({ id: identifierEntity.identityId });
  } catch (err: any) {
    if (!(err instanceof EntityNotFoundError)) {
      throw err;
    }
  }

  if (identityId) {
    throw new ClientError("Unauthorized", {
      description: "Identity not matched to any identifiers",
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  const identity = await identityRepository.create(new Identity({}));

  await identifierRepository.create(
    new Identifier({
      identifier,
      identityId: identity.id,
      primary: isPrimaryUsedByIdentifier(type),
      provider,
      type,
      verified: true,
    }),
  );

  return identity;
};
