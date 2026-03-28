import { stageAbstractMessage } from "#internal/message/metadata/stage-metadata";

const R_VERSION_SUFFIX = /_[vV]\d+$/;

export const AbstractMessage =
  () =>
  (target: Function, context: ClassDecoratorContext): void => {
    stageAbstractMessage(context.metadata, {
      decorator: "AbstractMessage",
      name: target.name.replace(R_VERSION_SUFFIX, ""),
    });
  };
