import { Context } from "../../types";
import { Identity } from "../../entity";

export const userinfoUsernameAdd = async (ctx: Context, identity: Identity): Promise<void> => {
  const {
    repository: { identityRepository },
  } = ctx;

  if (!identity.preferredUsername || identity.username) {
    return;
  }

  identity.username = identity.preferredUsername;

  await identityRepository.update(identity);
};
