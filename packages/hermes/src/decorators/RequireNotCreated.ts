import { stageMethodModifier } from "../internal/metadata/index.js";

export const RequireNotCreated =
  () =>
  (_target: Function, context: ClassMethodDecoratorContext): void => {
    stageMethodModifier(context.metadata, {
      methodName: String(context.name),
      modifier: "requireNotCreated",
    });
  };
