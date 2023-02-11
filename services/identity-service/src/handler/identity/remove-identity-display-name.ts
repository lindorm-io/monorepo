import { ServerKoaContext } from "../../types";
import { Identity } from "../../entity";

export const removeIdentityDisplayName = async (
  ctx: ServerKoaContext,
  identity: Identity,
): Promise<void> => {
  const {
    repository: { displayNameRepository },
  } = ctx;

  if (!identity.displayName.name || !identity.displayName.number) {
    return;
  }

  const entity = await displayNameRepository.find({
    name: identity.displayName.name,
  });

  entity.remove(identity.displayName.number);

  await displayNameRepository.update(entity);
};
