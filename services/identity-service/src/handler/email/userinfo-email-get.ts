import { ServerKoaContext } from "../../types";
import { orderBy } from "lodash";

interface Result {
  email: string | null;
  emailVerified: boolean;
}

const EMPTY: Result = {
  email: null,
  emailVerified: false,
};

export const userinfoEmailGet = async (
  ctx: ServerKoaContext,
  identityId: string,
): Promise<Result> => {
  const {
    repository: { emailRepository },
  } = ctx;

  try {
    const array = await emailRepository.findMany({ identityId });
    const ordered = orderBy(array, ["verified", "primary", "updated"], ["desc", "desc", "desc"]);

    if (!ordered.length) return EMPTY;

    const { email, verified } = ordered[0];

    return { email, emailVerified: verified };
  } catch (err: any) {
    return EMPTY;
  }
};
