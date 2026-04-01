import { snakeCase } from "@lindorm/case";
import { isArray } from "@lindorm/is";
import type { Constructor } from "@lindorm/types";
import { stageSaga } from "#internal/metadata";

type SagaOptions = {
  name?: string;
};

/**
 * Registers a class as a saga handler. A new instance is created for each
 * handler invocation -- do not rely on constructor injection or instance state
 * persisting between calls.
 */
export const Saga =
  (aggregateOrArray: Constructor | Array<Constructor>, options?: SagaOptions) =>
  (target: Function, context: ClassDecoratorContext): void => {
    const aggregates = isArray(aggregateOrArray) ? aggregateOrArray : [aggregateOrArray];

    stageSaga(context.metadata, {
      name: options?.name ?? snakeCase(target.name),
      aggregates,
    });
  };
