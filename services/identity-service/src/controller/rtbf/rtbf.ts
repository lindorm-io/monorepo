import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";

export const rtbfController: ServerKoaController = async (ctx): ControllerResponse => {
  const {
    entity: { identity },
    mongo: { addressRepository, identifierRepository, identityRepository },
  } = ctx;

  await addressRepository.deleteMany({ identityId: identity.id });
  await identifierRepository.deleteMany({ identityId: identity.id });
  await identityRepository.destroy(identity);
};
