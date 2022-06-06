import { EntityNotFoundError } from "@lindorm-io/entity";
import { Identifier, Identity } from "../../entity";
import { IdentifierType } from "../../common";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { configuration } from "../../server/configuration";
import { isIdentifierStoredSeparately } from "../../util";

interface Options {
  identifier: string;
  provider?: string;
  type: IdentifierType;
}

export const getIdentifierEntity = async (
  ctx: ServerKoaContext,
  identity: Identity,
  options: Options,
): Promise<Identifier> => {
  const {
    repository: { identifierRepository },
  } = ctx;

  const { identifier, type } = options;
  const provider = options.provider || configuration.server.domain;

  if (!isIdentifierStoredSeparately(type)) {
    throw new ServerError("Invalid identifier type", {
      debug: { type },
    });
  }

  try {
    return await identifierRepository.find({ identifier, provider, type });
  } catch (err: any) {
    if (!(err instanceof EntityNotFoundError)) {
      throw err;
    }

    return await identifierRepository.create(
      new Identifier({
        identifier,
        identityId: identity.id,
        primary: false,
        provider,
        type,
        verified: false,
      }),
    );
  }
};
