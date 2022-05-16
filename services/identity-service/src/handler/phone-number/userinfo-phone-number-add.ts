import { ServerKoaContext } from "../../types";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { PhoneNumber } from "../../entity";

interface Options {
  identityId: string;
  phoneNumber: string;
}

export const userinfoPhoneNumberAdd = async (
  ctx: ServerKoaContext,
  options: Options,
): Promise<PhoneNumber> => {
  const {
    repository: { phoneNumberRepository },
  } = ctx;

  const { identityId, phoneNumber } = options;

  try {
    return await phoneNumberRepository.find({ phoneNumber });
  } catch (err: any) {
    if (!(err instanceof EntityNotFoundError)) {
      throw err;
    }
  }

  const amount = await phoneNumberRepository.count({ identityId });

  return await phoneNumberRepository.create(
    new PhoneNumber({
      identityId,
      phoneNumber,
      primary: amount < 1,
      verified: false,
    }),
  );
};
