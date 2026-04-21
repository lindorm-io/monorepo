import type { Constructor } from "@lindorm/types";
import { stageHandler } from "../internal/metadata/index.js";

export const SagaIdHandler =
  (EventClass: Constructor) =>
  (_target: Function, context: ClassMethodDecoratorContext): void => {
    stageHandler(context.metadata, {
      kind: "SagaIdHandler",
      methodName: String(context.name),
      trigger: EventClass,
    });
  };
