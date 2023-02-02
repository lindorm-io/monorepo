import { EntityNotFoundError } from "@lindorm-io/entity";
import { Identifier, Identity } from "../../entity";
import { IdentifierType } from "../../common";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { configuration } from "../../server/configuration";
import { initialiseConnectSession, sendConnectSessionMessage } from "../sessions";
import { isIdentifierStoredSeparately, isPrimaryUsedByIdentifier } from "../../util";
import { randomString } from "@lindorm-io/random";

interface Options {
  identifier: string;
  provider?: string;
  type: IdentifierType;
}

export const addIdentifierFromUserinfo = async (
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
  }

  let primary = false;
  if (isPrimaryUsedByIdentifier(type)) {
    const amount = await identifierRepository.count({ identityId: identity.id, provider, type });
    primary = amount < 1;
  }

  const identifierEntity = await identifierRepository.create(
    new Identifier({
      identifier,
      identityId: identity.id,
      primary,
      provider,
      type,
      verified: false,
    }),
  );

  const code = randomString(64);
  const connectSession = await initialiseConnectSession(ctx, identifierEntity, code);

  await sendConnectSessionMessage(ctx, identifierEntity, connectSession, code);

  return identifierEntity;
};
