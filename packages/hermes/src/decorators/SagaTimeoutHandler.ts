import type { Constructor } from "@lindorm/types";
import { stageHandler } from "../internal/metadata/index.js";

export const SagaTimeoutHandler =
  (TimeoutClass: Constructor) =>
  (_target: Function, context: ClassMethodDecoratorContext): void => {
    stageHandler(context.metadata, {
      kind: "SagaTimeoutHandler",
      methodName: String(context.name),
      trigger: TimeoutClass,
    });
  };
