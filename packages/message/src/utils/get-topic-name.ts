import { kebabCase } from "@lindorm/case";
import { Constructor } from "@lindorm/types";
import { IMessage } from "../interfaces";
import { globalMessageMetadata } from "./global";

type Options = {
  namespace?: string | null;
  topic?: string | null;
};

export const getTopicName = <E extends IMessage>(
  Message: Constructor<E>,
  options: Options,
): string => {
  const metadata = globalMessageMetadata.get(Message);

  if (metadata.message.topic) return metadata.message.topic;
  if (options.topic) return options.topic;

  const namespace = metadata.message.namespace || options.namespace;
  const messageName = metadata.message.name || Message.name;
  const decorator = metadata.message.decorator;

  if (namespace === "system") {
    throw new Error("The 'system' namespace is reserved for internal use");
  }

  const n = namespace ? `${kebabCase(namespace)}.` : "";
  const d = decorator ? `${kebabCase(decorator)}.` : "";
  const e = kebabCase(messageName);

  const name = `${n}${d}${e}`;

  if (name.length > 120) {
    throw new Error(`Collection name exceeds 120 characters: ${name}`);
  }

  return name;
};
