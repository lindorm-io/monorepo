import { stagePersistent } from "../internal/message/metadata/stage-metadata.js";

export const Persistent =
  () =>
  (_target: Function, context: ClassDecoratorContext): void => {
    stagePersistent(context.metadata);
  };
