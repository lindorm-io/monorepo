import { Constructor, Dict } from "@lindorm/types";
import { ViewEventHandlerDecoratorOptions, ViewEventHandlerDescriptor } from "../types";
import { globalHermesMetadata } from "../utils/private";

export function ViewEventHandler<C extends Constructor, S extends Dict>(
  EventClass: C,
  options: ViewEventHandlerDecoratorOptions = {},
): ViewEventHandlerDescriptor<C, S> {
  return function (target, key, descriptor) {
    globalHermesMetadata.addHandler({
      conditions: options.conditions || null,
      decorator: "ViewEventHandler",
      encryption: false,
      handler: descriptor.value,
      key: key.toString(),
      schema: null,
      target: target.constructor as Constructor,
      trigger: EventClass,
    });
  };
}
