import { ClientError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { Identity } from "../../entity";

interface Options {
  identityId?: string;
  nationalIdentityNumber: string;
}

export const authenticateNationalIdentityNumber = async (
  ctx: ServerKoaContext,
  options: Options,
): Promise<Identity> => {
  const {
    repository: { identityRepository },
  } = ctx;

  const { identityId, nationalIdentityNumber } = options;

  try {
    const identity = await identityRepository.find({ nationalIdentityNumber });

    if (identityId && identityId !== identity.id) {
      throw new ClientError("Invalid Identity", {
        description: "Identifier does not belong to Identity",
        debug: {
          expect: identityId,
          actual: identity.id,
        },
      });
    }

    if (!identity.nationalIdentityNumberVerified) {
      identity.nationalIdentityNumberVerified = true;
      return identityRepository.update(identity);
    }

    return identity;
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

  return await identityRepository.create(
    new Identity({
      nationalIdentityNumber,
      nationalIdentityNumberVerified: true,
    }),
  );
};
