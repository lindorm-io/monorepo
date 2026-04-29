import { stageForgettable } from "../internal/metadata/index.js";

export const Forgettable =
  () =>
  (_target: Function, context: ClassDecoratorContext): void => {
    stageForgettable(context.metadata, { forgettable: true });
  };
