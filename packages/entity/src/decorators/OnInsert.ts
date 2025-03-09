import { HookDecoratorCallback } from "../types";
import { globalEntityMetadata } from "../utils";

export function OnInsert(callback: HookDecoratorCallback): ClassDecorator {
  return function (target) {
    globalEntityMetadata.addHook({
      target,
      decorator: "OnInsert",
      callback,
    });
  };
}
