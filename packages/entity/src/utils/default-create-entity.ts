import { isFunction } from "@lindorm/is";
import { Constructor, DeepPartial } from "@lindorm/types";
import { IEntity } from "../interfaces";
import { globalEntityMetadata } from "./global";
import { parseColumn } from "./private";

export const defaultCreateEntity = <
  E extends IEntity,
  O extends DeepPartial<E> = DeepPartial<E>,
>(
  target: Constructor<E>,
  options: O | E = {} as O,
): E => {
  const metadata = globalEntityMetadata.get(target);
  const entity = new target();

  for (const column of metadata.columns) {
    (entity as any)[column.key] = parseColumn(column, entity, options);

    if ((entity as any)[column.key]) continue;

    (entity as any)[column.key] = isFunction(column.fallback)
      ? column.fallback()
      : column.fallback;
  }

  const hooks = metadata.hooks.filter((h) => h.decorator === "OnCreate");

  for (const hook of hooks) {
    hook.callback(entity);
  }

  return entity;
};
