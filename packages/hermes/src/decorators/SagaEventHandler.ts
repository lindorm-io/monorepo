import type { Constructor } from "@lindorm/types";
import { stageHandler } from "#internal/metadata";

export const SagaEventHandler =
  (EventClass: Constructor) =>
  (_target: Function, context: ClassMethodDecoratorContext): void => {
    stageHandler(context.metadata, {
      kind: "SagaEventHandler",
      methodName: String(context.name),
      trigger: EventClass,
    });
  };
