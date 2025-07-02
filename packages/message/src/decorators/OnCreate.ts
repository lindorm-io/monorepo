import { HookDecoratorCallback } from "../types";
import { globalMessageMetadata } from "../utils";

export function OnCreate(callback: HookDecoratorCallback): ClassDecorator {
  return function (target) {
    globalMessageMetadata.addHook({
      target,
      decorator: "OnCreate",
      callback,
    });
  };
}
