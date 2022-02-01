import { Context } from "../../types";

interface Options {
  identityId: string;
  identifier: string;
}

export const removeExternalIdentifier = async (ctx: Context, options: Options): Promise<void> => {
  const {
    repository: { externalIdentifierRepository },
  } = ctx;

  const { identityId, identifier } = options;

  const entity = await externalIdentifierRepository.find({ identityId, identifier });

  await externalIdentifierRepository.destroy(entity);
};
