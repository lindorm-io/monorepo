import { isFunction } from "@lindorm/is";
import { Constructor } from "@lindorm/types";
import { IEntity } from "../interfaces";
import { MetaColumnDecorator } from "../types";
import { globalEntityMetadata } from "./global";
import { parseColumn } from "./private";

const reset: Array<MetaColumnDecorator> = [
  "CreateDateColumn",
  "ExpiryDateColumn",
  "DeleteDateColumn",
  "UpdateDateColumn",
  "VersionColumn",
];

export const defaultCloneEntity = <E extends IEntity>(
  Entity: Constructor<E>,
  entity: E,
): E => {
  const metadata = globalEntityMetadata.get(Entity);
  const clone = new Entity();

  for (const column of metadata.columns) {
    if (metadata.generated.some((g) => g.key === column.key)) continue;

    if (
      reset.includes(column.decorator) ||
      metadata.primaryKeys.includes(column.key) ||
      metadata.generated.some((g) => g.key === column.key) ||
      metadata.indexes.some((u) => u.unique && u.keys.every((k) => k.key === column.key))
    ) {
      (clone as any)[column.key] = undefined;
    } else {
      (clone as any)[column.key] = parseColumn(column, entity);
    }

    if ((clone as any)[column.key]) continue;

    (clone as any)[column.key] = isFunction(column.fallback)
      ? column.fallback()
      : column.fallback;
  }

  const hooks = metadata.hooks.filter((h) => h.decorator === "OnCreate");

  for (const hook of hooks) {
    hook.callback(entity);
  }

  return clone;
};
