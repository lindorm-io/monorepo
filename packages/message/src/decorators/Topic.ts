import { Constructor } from "@lindorm/types";
import { IMessage } from "../interfaces";
import { TopicDecoratorCallback } from "../types";
import { globalMessageMetadata } from "../utils";

export function Topic<C extends Constructor<IMessage>>(
  callback: TopicDecoratorCallback<InstanceType<C>>,
): (ctor: C) => void {
  return function (target) {
    globalMessageMetadata.addTopic<InstanceType<C>>({
      target,
      callback,
    });
  };
}
