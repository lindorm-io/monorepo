import { HookDecoratorCallback } from "../types";
import { globalEntityMetadata } from "../utils";

export function OnDestroy(callback: HookDecoratorCallback): ClassDecorator {
  return function (target) {
    globalEntityMetadata.addHook({
      target,
      decorator: "OnDestroy",
      callback,
    });
  };
}
