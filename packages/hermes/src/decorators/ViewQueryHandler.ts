import type { Constructor } from "@lindorm/types";
import { stageHandler } from "../internal/metadata";

export const ViewQueryHandler =
  (QueryClass: Constructor) =>
  (_target: Function, context: ClassMethodDecoratorContext): void => {
    stageHandler(context.metadata, {
      kind: "ViewQueryHandler",
      methodName: String(context.name),
      trigger: QueryClass,
    });
  };
