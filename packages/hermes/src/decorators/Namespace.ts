import { stageNamespace } from "../internal/metadata/index.js";

export const Namespace =
  (namespace: string) =>
  (_target: Function, context: ClassDecoratorContext): void => {
    stageNamespace(context.metadata, namespace);
  };
