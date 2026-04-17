import { stageMethodModifier } from "../internal/metadata";

export const RequireCreated =
  () =>
  (_target: Function, context: ClassMethodDecoratorContext): void => {
    stageMethodModifier(context.metadata, {
      methodName: String(context.name),
      modifier: "requireCreated",
    });
  };
