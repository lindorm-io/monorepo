import type { Constructor } from "@lindorm/types";
import { stageHandler } from "../internal/metadata/index.js";

export const ViewEventHandler =
  (EventClass: Constructor) =>
  (_target: Function, context: ClassMethodDecoratorContext): void => {
    stageHandler(context.metadata, {
      kind: "ViewEventHandler",
      methodName: String(context.name),
      trigger: EventClass,
    });
  };
