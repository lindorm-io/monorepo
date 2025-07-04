import { Constructor } from "@lindorm/types";
import { IMessage } from "../interfaces";
import { HookDecoratorCallback } from "../types";
import { globalMessageMetadata } from "../utils";

export function OnValidate<C extends Constructor<IMessage>>(
  callback: HookDecoratorCallback<InstanceType<C>>,
): (ctor: C) => void {
  return function (target) {
    globalMessageMetadata.addHook({
      target,
      decorator: "OnValidate",
      callback,
    });
  };
}
