import { kebabCase } from "@lindorm/case";
import { Constructor } from "@lindorm/types";
import { IMessage } from "../interfaces";
import { globalMessageMetadata } from "./global";

type Options = {
  namespace?: string | null;
  topic?: string | null;
};

export const getTopicName = <M extends IMessage>(
  MessageConstructor: Constructor<M>,
  message: M,
  options: Options,
): string => {
  const metadata = globalMessageMetadata.get(MessageConstructor);

  if (metadata.topic?.callback) {
    return metadata.topic.callback(message);
  }

  if (metadata.message.topic) return metadata.message.topic;
  if (options.topic) return options.topic;

  const namespace = metadata.message.namespace || options.namespace;
  const messageName = metadata.message.name || MessageConstructor.name;

  if (namespace === "system") {
    throw new Error("The 'system' namespace is reserved for internal use");
  }

  const n = namespace ? `${kebabCase(namespace)}.` : "";
  const e = kebabCase(messageName);

  const name = `${n}${e}`;

  if (name.length > 120) {
    throw new Error(`Topic name exceeds 120 characters: ${name}`);
  }

  return name;
};
