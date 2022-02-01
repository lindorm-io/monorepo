import { Context } from "../../types";
import { Email, Identity } from "../../entity";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { ClientError } from "@lindorm-io/errors";

interface Options {
  identityId?: string;
  email: string;
}

export const verifyEmail = async (ctx: Context, options: Options): Promise<Identity> => {
  const {
    repository: { identityRepository, emailRepository },
  } = ctx;

  const { identityId, email } = options;

  try {
    const entity = await emailRepository.find({ email });

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

  await emailRepository.create(
    new Email({
      email,
      identityId: identity.id,
      primary: true,
      verified: true,
    }),
  );

  return identity;
};
