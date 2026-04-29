import { stageNamespace } from "../internal/message/metadata/stage-metadata.js";

export const Namespace =
  (namespace: string) =>
  (_target: Function, context: ClassDecoratorContext): void => {
    stageNamespace(context.metadata, namespace);
  };
