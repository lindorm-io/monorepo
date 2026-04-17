import type { Constructor } from "@lindorm/types";
import { stageTopic } from "../internal/message/metadata/stage-metadata";

export const Topic =
  <T extends Constructor>(callback: (message: any) => string) =>
  (_target: T, context: ClassDecoratorContext<T>): void => {
    stageTopic(context.metadata, { callback });
  };
