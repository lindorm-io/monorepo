import { ServerKoaContext } from "../../types";
import { EntityNotFoundError } from "@lindorm-io/entity";

interface Options {
  identityId: string;
  phoneNumber: string;
}

export const setPrimaryPhoneNumber = async (
  ctx: ServerKoaContext,
  options: Options,
): Promise<void> => {
  const {
    repository: { phoneNumberRepository },
  } = ctx;

  const { identityId, phoneNumber } = options;

  try {
    const currentPrimary = await phoneNumberRepository.find({
      identityId,
      primary: true,
    });

    currentPrimary.primary = false;

    await phoneNumberRepository.update(currentPrimary);
  } catch (err: any) {
    if (!(err instanceof EntityNotFoundError)) {
      throw err;
    }
  }

  const newPrimary = await phoneNumberRepository.find({ identityId, phoneNumber });

  newPrimary.primary = true;

  await phoneNumberRepository.update(newPrimary);
};
