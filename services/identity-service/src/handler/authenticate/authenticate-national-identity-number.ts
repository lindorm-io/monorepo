import { ClientError } from "@lindorm-io/errors";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { Identity } from "../../entity";
import { ServerKoaContext } from "../../types";
import { randomUUID } from "crypto";

type Options = {
  identityId?: string;
  nationalIdentityNumber: string;
};

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

  const id = identityId || randomUUID();
  const identity = await identityRepository.findOrCreate({ id });

  identity.nationalIdentityNumber = nationalIdentityNumber;
  identity.nationalIdentityNumberVerified = true;

  return identityRepository.update(identity);
};
