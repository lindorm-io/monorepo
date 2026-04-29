import { stageDeadLetter } from "../internal/message/metadata/stage-metadata.js";

export const DeadLetter =
  () =>
  (_target: Function, context: ClassDecoratorContext): void => {
    stageDeadLetter(context.metadata);
  };
