import { Constructor } from "@lindorm/types";
import { IEntity } from "../interfaces";
import { globalEntityMetadata } from "./global";

export const defaultUpdateEntity = <E extends IEntity>(
  target: Constructor<E>,
  entity: E,
): E => {
  const metadata = globalEntityMetadata.get(target);

  const updateDate = metadata.columns.find((c) => c.decorator === "UpdateDateColumn");
  if (updateDate) {
    (entity as any)[updateDate.key] = new Date();
  }

  const version = metadata.columns.find((c) => c.decorator === "VersionColumn");
  if (version) {
    (entity as any)[version.key] = ((entity as any)[version.key] || 0) + 1;
  }

  return entity;
};
