import { isObject, isObjectLike } from "@lindorm/is";
import { Constructor, Dict } from "@lindorm/types";
import { IEntity } from "../interfaces";
import { globalEntityMetadata } from "./global";

export const defaultCreateDocument = <E extends IEntity>(
  target: Constructor<E>,
  entity: E,
): Dict => {
  const metadata = globalEntityMetadata.get(target);
  const document: Dict = {};

  for (const column of metadata.columns) {
    if (entity[column.key] === undefined) continue;
    document[column.key] = entity[column.key];
  }

  for (const relation of metadata.relations) {
    switch (relation.type) {
      case "OneToOne":
      case "ManyToOne":
        if (isObject(relation.joinKeys)) {
          for (const [key, value] of Object.entries(relation.joinKeys)) {
            if (
              isObjectLike(entity[relation.key]) &&
              entity[relation.key][value] != null
            ) {
              document[key] = entity[relation.key][value];
            } else if (document[key] == null) {
              document[key] = entity[key] ?? null;
            }
          }
        }
        break;

      default:
        break;
    }
  }

  return document;
};
