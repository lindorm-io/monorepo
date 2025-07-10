import { Constructor, Dict } from "@lindorm/types";
import {
  AggregateCommandHandlerDecoratorOptions,
  AggregateCommandHandlerDescriptor,
} from "../types";
import { globalHermesMetadata } from "../utils/private";

export function AggregateCommandHandler<C extends Constructor, S extends Dict>(
  CommandClass: C,
  options: AggregateCommandHandlerDecoratorOptions = {},
): AggregateCommandHandlerDescriptor<C, S> {
  return function (target, key, descriptor) {
    globalHermesMetadata.addHandler({
      conditions: options.conditions || null,
      decorator: "AggregateCommandHandler",
      encryption: options.encryption || false,
      handler: descriptor.value,
      key: key.toString(),
      schema: options.schema || null,
      target: target.constructor as Constructor,
      trigger: CommandClass,
    });
  };
}
