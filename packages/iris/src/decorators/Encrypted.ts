import type { AmphoraPredicate } from "@lindorm/amphora";
import { stageEncrypted } from "#internal/message/metadata/stage-metadata";

export const Encrypted =
  (predicate: AmphoraPredicate = {}) =>
  (_target: Function, context: ClassDecoratorContext): void => {
    stageEncrypted(context.metadata, { predicate });
  };
