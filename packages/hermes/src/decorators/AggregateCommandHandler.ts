import type { Constructor } from "@lindorm/types";
import { stageHandler } from "../internal/metadata";

export const AggregateCommandHandler =
  (CommandClass: Constructor) =>
  (_target: Function, context: ClassMethodDecoratorContext): void => {
    stageHandler(context.metadata, {
      kind: "AggregateCommandHandler",
      methodName: String(context.name),
      trigger: CommandClass,
    });
  };
