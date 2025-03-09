import { HookDecoratorCallback } from "../types";
import { globalEntityMetadata } from "../utils";

export function OnCreate(callback: HookDecoratorCallback): ClassDecorator {
  return function (target) {
    globalEntityMetadata.addHook({
      target,
      decorator: "OnCreate",
      callback,
    });
  };
}
