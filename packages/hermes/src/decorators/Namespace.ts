import { stageNamespace } from "#internal/metadata";

export const Namespace =
  (namespace: string) =>
  (_target: Function, context: ClassDecoratorContext): void => {
    stageNamespace(context.metadata, namespace);
  };
