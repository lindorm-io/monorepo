import { camelCase, snakeCase } from "@lindorm/case";
import { Dict } from "@lindorm/types";
import { EntityMetadata } from "../../types";

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
