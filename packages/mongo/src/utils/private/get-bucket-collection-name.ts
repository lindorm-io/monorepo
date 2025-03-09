import { getCollectionName } from "@lindorm/entity";
import { Constructor } from "@lindorm/types";
import { IMongoFile } from "../../interfaces";

type Options = {
  namespace?: string | null;
};

export const getBucketCollectionName = <F extends IMongoFile>(
  Entity: Constructor<F>,
  options: Options,
): string => {
  return `${getCollectionName(Entity, options)}.files`;
};
