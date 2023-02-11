import { ServerKoaContext } from "../../types";
import { Identity } from "../../entity";

export const updateIdentityDisplayName = async (
  ctx: ServerKoaContext,
  identity: Identity,
  displayName: string,
): Promise<void> => {
  const {
    repository: { displayNameRepository },
  } = ctx;

  if (identity.displayName.name && identity.displayName.number) {
    const current = await displayNameRepository.find({
      name: identity.displayName.name,
    });

    current.remove(identity.displayName.number);

    await displayNameRepository.update(current);
  }

  const entity = await displayNameRepository.findOrCreate({ name: displayName });
  const number = await entity.generateNumber();

  entity.add(number);

  await displayNameRepository.update(entity);

  identity.displayName = {
    name: displayName,
    number,
  };
};
