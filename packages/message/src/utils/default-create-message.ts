import { isFunction } from "@lindorm/is";
import { Constructor, DeepPartial } from "@lindorm/types";
import { IMessage } from "../interfaces";
import { globalMessageMetadata } from "./global";
import { parseField } from "./private";

export const defaultCreateMessage = <
  E extends IMessage,
  O extends DeepPartial<E> = DeepPartial<E>,
>(
  Message: Constructor<E>,
  options: O | E = {} as O,
): E => {
  const metadata = globalMessageMetadata.get(Message);
  const message = new Message();

  for (const field of metadata.fields) {
    (message as any)[field.key] = parseField(field, message, options);

    if ((message as any)[field.key]) continue;

    (message as any)[field.key] = isFunction(field.fallback)
      ? field.fallback()
      : field.fallback;
  }

  const hooks = metadata.hooks.filter((h) => h.decorator === "OnCreate");

  for (const hook of hooks) {
    hook.callback(message);
  }

  return message;
};
