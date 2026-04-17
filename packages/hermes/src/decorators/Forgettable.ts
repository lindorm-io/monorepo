import { stageForgettable } from "../internal/metadata";

export const Forgettable =
  () =>
  (_target: Function, context: ClassDecoratorContext): void => {
    stageForgettable(context.metadata, { forgettable: true });
  };
