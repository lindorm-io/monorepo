import type { Constructor } from "@lindorm/types";
import type { HookCallback } from "../types/index.js";
import { stageHook } from "../internal/message/metadata/stage-metadata.js";

export const AfterPublish =
  <T extends Constructor>(callback: HookCallback) =>
  (_target: T, context: ClassDecoratorContext<T>): void => {
    stageHook(context.metadata, { decorator: "AfterPublish", callback });
  };
