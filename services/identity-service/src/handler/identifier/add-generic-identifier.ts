import { ClientError } from "@lindorm-io/errors";
import { Identifier, IdentifierAttributes, Identity } from "../../entity";
import { ServerKoaContext } from "../../types";
import { IdentifierType } from "@lindorm-io/common-types";

type Options = Pick<IdentifierAttributes, "type" | "value" | "verified"> &
  Partial<Pick<IdentifierAttributes, "label" | "provider">>;

export const addGenericIdentifier = async (
  ctx: ServerKoaContext,
  identity: Identity,
  options: Options,
): Promise<void> => {
  const {
    logger,
    repository: { identifierRepository },
  } = ctx;

  const { label, provider, type, value, verified } = options;

  if (type === IdentifierType.EXTERNAL && !provider) {
    throw new ClientError("Provider is required", {
      description: "When type is [ external ] the option [ provider ] is required",
    });
  }

  const existing = await identifierRepository.tryFind({
    type,
    value,
    verified: true,
  });

  if (existing && existing.identityId === identity.id && existing.verified) {
    logger.verbose("Existing identifier already linked to identity and verified", {
      identifier: value,
      identityId: existing.identityId,
    });

    return;
  }

  if (existing && existing.identityId === identity.id && !existing.verified && verified) {
    existing.verified = true;

    await identifierRepository.update(existing);

    logger.verbose("Updated existing identifier to verified", {
      identifier: value,
      identityId: existing.identityId,
    });

    return;
  }

  if (existing && existing.identityId !== identity.id && !verified) {
    throw new ClientError("Invalid request", {
      description: "Trying to overwrite unverified identifier when current verified already exists",
      debug: {
        identifier: value,
        currentIdentity: existing.identityId,
        newIdentity: identity.id,
      },
      statusCode: ClientError.StatusCode.FORBIDDEN,
    });
  }

  if (existing && verified) {
    logger.warn("Changing verified identity for identifier", {
      identifier: value,
      currentIdentity: existing.identityId,
      newIdentity: identity.id,
    });

    existing.verified = false;

    await identifierRepository.update(existing);
  }

  const primaryEntity = await identifierRepository.tryFind({
    identityId: identity.id,
    primary: true,
    type,
  });

  await identifierRepository.create(
    new Identifier({
      identityId: identity.id,
      label,
      primary: primaryEntity === undefined,
      provider: provider || ctx.server.domain,
      type,
      value,
      verified,
    }),
  );
};
