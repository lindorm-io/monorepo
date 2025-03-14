import { EntityMetadata, MetaIndex } from "@lindorm/entity";

export const getBucketMetadataIndexes = (
  metadata: EntityMetadata,
): Array<Omit<MetaIndex, "target">> =>
  metadata.indexes.map((i) => ({
    ...i,
    index: i.keys.reduce(
      (acc, { key, direction }) => ({
        ...acc,
        [`metadata.${key}`]: direction,
      }),
      {},
    ),
  }));
