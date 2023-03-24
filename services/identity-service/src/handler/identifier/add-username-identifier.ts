import { ClientError } from "@lindorm-io/errors";
import { Identity } from "../../entity";
import { ServerKoaContext } from "../../types";

export const addUsernameIdentifier = async (
  ctx: ServerKoaContext,
  identity: Identity,
  username: string,
): Promise<void> => {
  const {
    logger,
    mongo: { identityRepository },
  } = ctx;

  const existing = await identityRepository.tryFind({ username });

  if (existing && existing.id === identity.id) {
    logger.verbose("Existing identifier already linked to identity and verified", {
      identifier: username,
      identityId: existing.id,
    });

    return;
  }

  if (existing && existing.id !== identity.id) {
    throw new ClientError("Invalid request", {
      description: "Trying to overwrite identifier when current already exists",
      debug: {
        identifier: username,
        currentIdentity: existing.id,
        newIdentity: identity.id,
      },
      statusCode: ClientError.StatusCode.FORBIDDEN,
    });
  }

  identity.preferredUsername = username;
  identity.username = username;

  await identityRepository.update(identity);
};
