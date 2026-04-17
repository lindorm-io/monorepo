import { stageBroadcast } from "../internal/message/metadata/stage-metadata";

export const Broadcast =
  () =>
  (_target: Function, context: ClassDecoratorContext): void => {
    stageBroadcast(context.metadata);
  };
