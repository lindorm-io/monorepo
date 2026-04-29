import { snakeCase } from "@lindorm/case";
import { stageAggregate } from "../internal/metadata/index.js";

/**
 * Registers a class as an aggregate handler. A new instance is created for
 * each handler invocation -- do not rely on constructor injection or instance
 * state persisting between calls.
 */
export const Aggregate =
  (name?: string) =>
  (target: Function, context: ClassDecoratorContext): void => {
    stageAggregate(context.metadata, {
      name: name ?? snakeCase(target.name),
    });
  };
