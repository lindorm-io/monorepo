import { ClientError } from "@lindorm-io/errors";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { Identifier } from "../../entity";
import { ServerKoaContext } from "../../types";
import { isPrimaryUsedByIdentifier } from "../../util";

export const setIdentifierAsPrimary = async (
  ctx: ServerKoaContext,
  identifier: Identifier,
): Promise<Identifier> => {
  const {
    repository: { identifierRepository },
  } = ctx;

  if (!isPrimaryUsedByIdentifier(identifier.type)) {
    throw new ClientError("Invalid identifier type");
  }

  try {
    const current = await identifierRepository.find({
      identityId: identifier.identityId,
      primary: true,
      provider: identifier.provider,
      type: identifier.type,
    });

    current.primary = false;

    await identifierRepository.update(current);
  } catch (err: any) {
    if (!(err instanceof EntityNotFoundError)) {
      throw err;
    }
  }

  identifier.primary = true;

  return await identifierRepository.update(identifier);
};
