import { MessageDecoratorOptions } from "../types";
import { globalMessageMetadata } from "../utils";

export function Message(options: MessageDecoratorOptions = {}): ClassDecorator {
  return function (target) {
    globalMessageMetadata.addMessage({
      target,
      decorator: "Message",
      name: options?.name || null,
      namespace: options?.namespace || null,
      topic: options?.topic || null,
    });
  };
}
