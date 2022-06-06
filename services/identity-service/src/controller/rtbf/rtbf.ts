import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { removeIdentityDisplayName } from "../../handler";

export const rtbfController: ServerKoaController = async (ctx): ControllerResponse => {
  const {
    entity: { identity },
    repository: { addressRepository, identifierRepository, identityRepository },
  } = ctx;

  if (identity.displayName.name) {
    await removeIdentityDisplayName(ctx, identity);
  }

  await addressRepository.deleteMany({ identityId: identity.id });
  await identifierRepository.deleteMany({ identityId: identity.id });
  await identityRepository.destroy(identity);
};
