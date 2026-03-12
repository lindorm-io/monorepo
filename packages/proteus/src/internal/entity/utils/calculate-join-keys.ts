import { camelCase, snakeCase } from "@lindorm/case";
import type { Dict } from "@lindorm/types";
import type { EntityMetadata } from "../types/metadata";

export const calculateJoinKeys = (
  relation: { key: string },
  metadata: Omit<EntityMetadata, "relations">,
): Dict<string> => {
  const prefix = snakeCase(relation.key);
  const result: Dict = {};
  for (const key of metadata.primaryKeys) {
    result[camelCase(`${prefix}_${key}`)] = key;
  }
  return result;
};
