import { ClientError } from "@lindorm-io/errors";
import { Identifier, Identity } from "../../entity";
import { IdentifierType } from "../../common";
import { ServerKoaContext } from "../../types";
import { configuration } from "../../server/configuration";

interface Options {
  identifier: string;
  provider?: string;
  type: IdentifierType;
}

export const findVerifiedIdentifier = async (
  ctx: ServerKoaContext,
  identity: Identity,
  options: Options,
): Promise<Identifier> => {
  const {
    repository: { identifierRepository },
  } = ctx;

  const { identifier, provider, type } = options;

  const identifierEntity = await identifierRepository.find({
    identifier,
    identityId: identity.id,
    provider: provider || configuration.server.domain,
    type,
  });

  if (!identifierEntity.verified) {
    throw new ClientError("Invalid request", {
      description: "Unable to set unverified identifier as primary",
    });
  }

  return identifierEntity;
};
