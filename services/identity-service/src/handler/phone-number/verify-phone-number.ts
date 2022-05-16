import { ClientError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { Identity, PhoneNumber } from "../../entity";

interface Options {
  identityId?: string;
  phoneNumber: string;
}

export const verifyPhoneNumber = async (
  ctx: ServerKoaContext,
  options: Options,
): Promise<Identity> => {
  const {
    repository: { identityRepository, phoneNumberRepository },
  } = ctx;

  const { identityId, phoneNumber } = options;

  try {
    const entity = await phoneNumberRepository.find({ phoneNumber });

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

  await phoneNumberRepository.create(
    new PhoneNumber({
      identityId: identity.id,
      phoneNumber,
      primary: true,
      verified: true,
    }),
  );

  return identity;
};
