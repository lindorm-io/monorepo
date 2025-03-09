import { HookDecoratorCallback } from "../types";
import { globalEntityMetadata } from "../utils";

export function OnValidate(callback: HookDecoratorCallback): ClassDecorator {
  return function (target) {
    globalEntityMetadata.addHook({
      target,
      decorator: "OnValidate",
      callback,
    });
  };
}
