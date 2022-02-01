import { Context } from "../../types";
import { ExternalIdentifier } from "../../entity";
import { EntityNotFoundError } from "@lindorm-io/entity";

interface Options {
  identityId: string;
  identifier: string;
  provider: string;
}

export const userinfoExternalIdentifierAdd = async (
  ctx: Context,
  options: Options,
): Promise<ExternalIdentifier> => {
  const {
    repository: { externalIdentifierRepository },
  } = ctx;

  const { identityId, identifier, provider } = options;

  try {
    return await externalIdentifierRepository.find({ identifier, provider });
  } catch (err: any) {
    if (!(err instanceof EntityNotFoundError)) {
      throw err;
    }
  }

  return await externalIdentifierRepository.create(
    new ExternalIdentifier({
      identityId,
      identifier,
      provider,
    }),
  );
};
