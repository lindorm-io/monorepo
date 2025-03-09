import { HookDecoratorCallback } from "../types";
import { globalEntityMetadata } from "../utils";

export function OnUpdate(callback: HookDecoratorCallback): ClassDecorator {
  return function (target) {
    globalEntityMetadata.addHook({
      target,
      decorator: "OnUpdate",
      callback,
    });
  };
}
