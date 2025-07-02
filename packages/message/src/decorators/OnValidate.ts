import { HookDecoratorCallback } from "../types";
import { globalMessageMetadata } from "../utils";

export function OnValidate(callback: HookDecoratorCallback): ClassDecorator {
  return function (target) {
    globalMessageMetadata.addHook({
      target,
      decorator: "OnValidate",
      callback,
    });
  };
}
