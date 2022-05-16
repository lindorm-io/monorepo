import { ServerKoaContext } from "../../types";
import { Email } from "../../entity";
import { EntityNotFoundError } from "@lindorm-io/entity";

interface Options {
  identityId: string;
  email: string;
}

export const userinfoEmailAdd = async (ctx: ServerKoaContext, options: Options): Promise<Email> => {
  const {
    repository: { emailRepository },
  } = ctx;

  const { identityId, email } = options;

  try {
    return await emailRepository.find({ email });
  } catch (err: any) {
    if (!(err instanceof EntityNotFoundError)) {
      throw err;
    }
  }

  const amount = await emailRepository.count({ identityId });

  return await emailRepository.create(
    new Email({
      identityId,
      email,
      primary: amount < 1,
      verified: false,
    }),
  );
};
