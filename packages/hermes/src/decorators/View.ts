import { snakeCase } from "@lindorm/case";
import { isArray } from "@lindorm/is";
import type { Constructor } from "@lindorm/types";
import { stageView } from "../internal/metadata";

const resolveEntityName = (entityClass: Constructor): string => {
  const meta = (entityClass as any)[Symbol.metadata];
  if (meta?.entity?.name) {
    return meta.entity.name;
  }
  return snakeCase(entityClass.name);
};

/**
 * Registers a class as a view handler. A new instance is created for each
 * handler invocation -- do not rely on constructor injection or instance state
 * persisting between calls.
 */
export const View =
  (
    aggregateOrArray: Constructor | Array<Constructor>,
    entityClass: Constructor,
    driverType?: string,
  ) =>
  (_target: Function, context: ClassDecoratorContext): void => {
    const aggregates = isArray(aggregateOrArray) ? aggregateOrArray : [aggregateOrArray];

    stageView(context.metadata, {
      name: resolveEntityName(entityClass),
      aggregates,
      entity: entityClass,
      driverType: driverType ?? null,
    });
  };
