import { ClientError } from "@lindorm-io/errors";
import { Context } from "../../types";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { Identity, ExternalIdentifier } from "../../entity";

interface Options {
  identifier: string;
  identityId?: string;
  provider: string;
}

export const verifyExternalIdentifier = async (
  ctx: Context,
  options: Options,
): Promise<Identity> => {
  const {
    repository: { identityRepository, externalIdentifierRepository },
  } = ctx;

  const { identifier, identityId, provider } = options;

  try {
    const entity = await externalIdentifierRepository.find({ identifier, provider });

    if (identityId && identityId !== entity.identityId) {
      throw new ClientError("Invalid Identity", {
        description: "Identifier does not belong to Identity",
        debug: {
          expect: identityId,
          actual: entity.identityId,
        },
      });
    }

    return await identityRepository.find({ id: entity.identityId });
  } catch (err: any) {
    if (!(err instanceof EntityNotFoundError)) {
      throw err;
    }
  }

  const identity = await identityRepository.create(
    new Identity({
      ...(identityId ? { id: identityId } : {}),
    }),
  );

  await externalIdentifierRepository.create(
    new ExternalIdentifier({
      identityId: identity.id,
      identifier,
      provider,
    }),
  );

  return identity;
};
