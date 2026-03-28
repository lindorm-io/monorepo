import type { Constructor } from "@lindorm/types";
import type { ErrorHookCallback } from "../types";
import { stageHook } from "#internal/message/metadata/stage-metadata";

export const OnConsumeError =
  <T extends Constructor>(callback: ErrorHookCallback) =>
  (_target: T, context: ClassDecoratorContext<T>): void => {
    stageHook(context.metadata, {
      decorator: "OnConsumeError",
      callback: (message, context, ...extra) =>
        callback(extra[0] as Error, message, context),
    });
  };
