import { EntityMetadata } from "@lindorm/entity";
import { CreateIndexesOptions } from "mongodb";
import { MongoBaseIndex } from "../../types";

const getPartialFilterExpression = (
  metadata: EntityMetadata,
  keys: Array<string>,
): Partial<CreateIndexesOptions> => {
  const nullable = metadata.columns
    .filter((a) => a.nullable && keys.includes(a.key))
    .map((a) => a.key);

  const finite = metadata.columns
    .filter((a) => a.min && a.min > 0 && keys.includes(a.key))
    .map((a) => a.key);

  if (!nullable.length && !finite.length) {
    return {};
  }

  return {
    partialFilterExpression: {
      ...nullable.reduce((a, k) => ({ ...a, [k]: { $exists: true } }), {}),
      ...finite.reduce((a, k) => ({ ...a, [k]: { $gt: 0 } }), {}),
    },
  };
};

export const getIndexOptions = (metadata: EntityMetadata): Array<MongoBaseIndex> => {
  const result: Array<MongoBaseIndex> = [];

  result.push({
    index: metadata.primaryKeys.reduce((a, k) => ({ ...a, [k]: 1 }), {}),
    options: {
      unique: true,
      ...getPartialFilterExpression(metadata, metadata.primaryKeys),
    },
  });

  for (const index of metadata.indexes) {
    result.push({
      index: index.keys.reduce(
        (acc, { key, direction }) => ({
          ...acc,
          [key]: direction === "asc" ? 1 : direction === "desc" ? -1 : direction,
        }),
        {},
      ),
      options: {
        ...(index.name ? { name: index.name } : {}),
        ...getPartialFilterExpression(
          metadata,
          index.keys.map((i) => i.key),
        ),
        unique: index.unique,
        ...index.options,
      },
    });
  }

  return result;
};
