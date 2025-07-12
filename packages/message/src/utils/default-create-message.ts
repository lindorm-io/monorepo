import { isFunction } from "@lindorm/is";
import { Constructor, DeepPartial } from "@lindorm/types";
import { IMessage } from "../interfaces";
import { globalMessageMetadata } from "./global";
import { parseField } from "./private";

export const defaultCreateMessage = <
  M extends IMessage,
  O extends DeepPartial<M> = DeepPartial<M>,
>(
  target: Constructor<M>,
  options: O | M = {} as O,
): M => {
  const metadata = globalMessageMetadata.get(target);
  const message = new target();

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
