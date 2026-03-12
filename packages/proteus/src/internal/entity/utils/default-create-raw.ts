import { isObject, isObjectLike } from "@lindorm/is";
import type { Constructor, Dict } from "@lindorm/types";
import { IEntity } from "../../../interfaces";
import { getEntityMetadata } from "../metadata/get-entity-metadata";

export const defaultCreateRaw = <E extends IEntity>(
  target: Constructor<E>,
  entity: E,
): Dict => {
  const metadata = getEntityMetadata(target);
  const document: Dict = {};

  for (const field of metadata.fields) {
    if (entity[field.key] === undefined) continue;
    document[field.key] = entity[field.key];
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
