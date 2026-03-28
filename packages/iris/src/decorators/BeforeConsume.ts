import type { Constructor } from "@lindorm/types";
import type { HookCallback } from "../types";
import { stageHook } from "#internal/message/metadata/stage-metadata";

export const BeforeConsume =
  <T extends Constructor>(callback: HookCallback) =>
  (_target: T, context: ClassDecoratorContext<T>): void => {
    stageHook(context.metadata, { decorator: "BeforeConsume", callback });
  };
