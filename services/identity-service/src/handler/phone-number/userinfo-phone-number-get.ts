import { ServerKoaContext } from "../../types";
import { orderBy } from "lodash";

interface Result {
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
}

const EMPTY: Result = {
  phoneNumber: null,
  phoneNumberVerified: false,
};

export const userinfoPhoneNumberGet = async (
  ctx: ServerKoaContext,
  identityId: string,
): Promise<Result> => {
  const {
    repository: { phoneNumberRepository },
  } = ctx;

  try {
    const array = await phoneNumberRepository.findMany({ identityId });

    const ordered = orderBy(array, ["verified", "primary", "updated"], ["desc", "desc", "desc"]);

    if (!ordered.length) return EMPTY;

    const { phoneNumber, verified } = ordered[0];

    return { phoneNumber, phoneNumberVerified: verified };
  } catch (err: any) {
    return EMPTY;
  }
};
