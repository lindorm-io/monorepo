import { registerMessage } from "../internal/message/metadata/registry.js";
import { stageMessage } from "../internal/message/metadata/stage-metadata.js";
import type { MessageDecoratorOptions } from "../types/decorator-options.js";

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
