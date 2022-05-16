import { ClientError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { Identity } from "../../entity";

interface Options {
  identityId?: string;
  nationalIdentityNumber: string;
}

export const verifyNationalIdentityNumber = async (
  ctx: ServerKoaContext,
  options: Options,
): Promise<Identity> => {
  const {
    repository: { identityRepository },
  } = ctx;

  const { identityId, nationalIdentityNumber } = options;

  try {
    const entity = await identityRepository.find({ nationalIdentityNumber });

    if (identityId && identityId !== entity.id) {
      throw new ClientError("Invalid Identity", {
        description: "Identifier does not belong to Identity",
        debug: {
          expect: identityId,
          actual: entity.id,
        },
      });
    }

    return entity;
  } catch (err: any) {
    if (!(err instanceof EntityNotFoundError)) {
      throw err;
    }
  }

  return await identityRepository.create(
    new Identity({
      ...(identityId ? { id: identityId } : {}),
      nationalIdentityNumber,
    }),
  );
};
