import { Constructor } from "@lindorm/types";
import { IMessage } from "../interfaces";
import { MessageDecoratorOptions } from "../types";
import { globalMessageMetadata } from "../utils";

export function Message(options: MessageDecoratorOptions = {}): ClassDecorator {
  return function (target) {
    globalMessageMetadata.addMessage({
      decorator: "Message",
      name: options?.name || target.name,
      namespace: options?.namespace || null,
      target: target as unknown as Constructor<IMessage>,
      topic: options?.topic || null,
    });
  };
}
