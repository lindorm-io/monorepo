import { Identity } from "../../entity";
import { ServerKoaContext } from "../../types";

export const updateIdentityDisplayName = async (
  ctx: ServerKoaContext,
  identity: Identity,
  name: string,
): Promise<Identity> => {
  const {
    mongo: { displayNameRepository },
  } = ctx;

  const displayName = await displayNameRepository.findOrCreate({ name });
  displayName.number = displayName.number + 1;

  await displayNameRepository.update(displayName);

  identity.displayName = { name, number: displayName.number };

  return identity;
};
