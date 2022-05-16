import { ServerKoaContext } from "../../types";

export const getConnectedProviders = async (
  ctx: ServerKoaContext,
  identityId: string,
): Promise<Array<string>> => {
  const {
    repository: { externalIdentifierRepository },
  } = ctx;

  const array = await externalIdentifierRepository.findMany({ identityId });
  const list: Array<string> = [];

  for (const item of array) {
    list.push(item.provider);
  }

  return list;
};
