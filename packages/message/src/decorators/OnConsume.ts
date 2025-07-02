import { HookDecoratorCallback } from "../types";
import { globalMessageMetadata } from "../utils";

export function OnConsume(callback: HookDecoratorCallback): ClassDecorator {
  return function (target) {
    globalMessageMetadata.addHook({
      target,
      decorator: "OnConsume",
      callback,
    });
  };
}
