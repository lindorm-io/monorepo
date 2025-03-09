import { EntityMetadata, MetaIndex } from "@lindorm/entity";

export const getBucketMetadataIndexes = (
  metadata: EntityMetadata,
): Array<Omit<MetaIndex, "target">> =>
  metadata.indexes.map((i) => ({
    ...i,
    index: Object.entries(i.index).reduce(
      (acc, [key, direction]) => ({
        ...acc,
        [`metadata.${key}`]: direction,
      }),
      {},
    ),
  }));
