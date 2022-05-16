import { ServerKoaContext } from "../../types";
import { ClientError } from "@lindorm-io/errors";

interface Options {
  identityId: string;
  email: string;
}

export const removeEmail = async (ctx: ServerKoaContext, options: Options): Promise<void> => {
  const {
    repository: { emailRepository },
  } = ctx;

  const { identityId, email } = options;

  const entity = await emailRepository.find({ identityId, email });

  if (entity.primary) {
    throw new ClientError("Unable to remove primary email");
  }

  await emailRepository.destroy(entity);
};
