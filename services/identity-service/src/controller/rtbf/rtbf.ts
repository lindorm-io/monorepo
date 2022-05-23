import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { removeIdentityDisplayName } from "../../handler";

export const rtbfController: ServerKoaController = async (ctx): ControllerResponse => {
  const {
    entity: { identity },
    repository: {
      emailRepository,
      identityRepository,
      externalIdentifierRepository,
      phoneNumberRepository,
    },
  } = ctx;

  if (identity.displayName.name) {
    await removeIdentityDisplayName(ctx, identity);
  }

  await emailRepository.deleteMany({ identityId: identity.id });
  await externalIdentifierRepository.deleteMany({ identityId: identity.id });
  await phoneNumberRepository.deleteMany({ identityId: identity.id });
  await identityRepository.destroy(identity);
};
