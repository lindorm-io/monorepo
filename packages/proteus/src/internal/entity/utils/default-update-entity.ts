import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../../interfaces/index.js";
import { incrementVersion } from "./increment-version.js";
import { getEntityMetadata } from "../metadata/get-entity-metadata.js";

export const defaultUpdateEntity = <E extends IEntity>(
  target: Constructor<E>,
  entity: E,
): E => {
  const metadata = getEntityMetadata(target);
  const updateDate = metadata.fields.find((f) => f.decorator === "UpdateDate");
  if (updateDate) {
    (entity as any)[updateDate.key] = new Date();
  }
  incrementVersion(metadata, entity);
  return entity;
};
