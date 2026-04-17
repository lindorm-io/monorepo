import { registerMessage } from "../internal/message/metadata/registry";
import { stageMessage } from "../internal/message/metadata/stage-metadata";
import type { MessageDecoratorOptions } from "../types/decorator-options";

const R_VERSION_SUFFIX = /_[vV]\d+$/;

export const Message =
  (options: MessageDecoratorOptions = {}) =>
  (target: Function, context: ClassDecoratorContext): void => {
    const raw = options.name ?? target.name;
    const name = raw.replace(R_VERSION_SUFFIX, "");

    stageMessage(context.metadata, {
      decorator: "Message",
      name,
    });

    registerMessage(name, target);
  };
