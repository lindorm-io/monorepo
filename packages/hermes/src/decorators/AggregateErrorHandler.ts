import type { Constructor } from "@lindorm/types";
import { stageHandler } from "../internal/metadata";

/**
 * Registers a method as an error handler for the given error class within an
 * aggregate. If this handler throws or permanently fails, the message will be
 * retried by Iris until its dead-letter queue policy takes effect. Configure
 * retry limits and DLQ via Iris source options.
 */
export const AggregateErrorHandler =
  (ErrorClass: Constructor) =>
  (_target: Function, context: ClassMethodDecoratorContext): void => {
    stageHandler(context.metadata, {
      kind: "AggregateErrorHandler",
      methodName: String(context.name),
      trigger: ErrorClass,
    });
  };
