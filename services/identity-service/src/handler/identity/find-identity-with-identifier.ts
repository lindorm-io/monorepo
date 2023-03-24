import { ServerKoaContext } from "../../types";
import { IdentifierAttributes, Identity } from "../../entity";

type Options = Pick<IdentifierAttributes, "type" | "value"> &
  Partial<Pick<IdentifierAttributes, "provider">>;

export const findIdentityWithIdentifier = async (
  ctx: ServerKoaContext,
  options: Options,
): Promise<Identity | undefined> => {
  const {
    mongo: { identifierRepository, identityRepository },
  } = ctx;

  const { provider, type, value } = options;

  const foundIdentifier = await identifierRepository.tryFind({
    type,
    value,
    verified: true,
    ...(provider ? { provider } : {}),
  });

  if (!foundIdentifier) return;

  return await identityRepository.find({ id: foundIdentifier.identityId });
};
